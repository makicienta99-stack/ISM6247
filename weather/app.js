// Glass Weather — powered by the free Open-Meteo API (no API key required).

const DEFAULT_NAME = "Eliana";

const DEFAULT_LOCATION = {
  name: "Boca Raton",
  admin1: "Florida",
  country: "United States",
  latitude: 26.3683,
  longitude: -80.1289,
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// WMO weather interpretation codes → description + day/night icons + background theme
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙", "clear"],
  1: ["Mainly clear", "🌤️", "🌙", "clear"],
  2: ["Partly cloudy", "⛅", "☁️", "cloudy"],
  3: ["Overcast", "☁️", "☁️", "cloudy"],
  45: ["Fog", "🌫️", "🌫️", "fog"],
  48: ["Depositing rime fog", "🌫️", "🌫️", "fog"],
  51: ["Light drizzle", "🌦️", "🌧️", "rain"],
  53: ["Drizzle", "🌦️", "🌧️", "rain"],
  55: ["Dense drizzle", "🌧️", "🌧️", "rain"],
  56: ["Freezing drizzle", "🌧️", "🌧️", "rain"],
  57: ["Dense freezing drizzle", "🌧️", "🌧️", "rain"],
  61: ["Light rain", "🌦️", "🌧️", "rain"],
  63: ["Rain", "🌧️", "🌧️", "rain"],
  65: ["Heavy rain", "🌧️", "🌧️", "rain"],
  66: ["Freezing rain", "🌧️", "🌧️", "rain"],
  67: ["Heavy freezing rain", "🌧️", "🌧️", "rain"],
  71: ["Light snow", "🌨️", "🌨️", "snow"],
  73: ["Snow", "🌨️", "🌨️", "snow"],
  75: ["Heavy snow", "❄️", "❄️", "snow"],
  77: ["Snow grains", "🌨️", "🌨️", "snow"],
  80: ["Light showers", "🌦️", "🌧️", "rain"],
  81: ["Showers", "🌧️", "🌧️", "rain"],
  82: ["Violent showers", "⛈️", "⛈️", "storm"],
  85: ["Snow showers", "🌨️", "🌨️", "snow"],
  86: ["Heavy snow showers", "❄️", "❄️", "snow"],
  95: ["Thunderstorm", "⛈️", "⛈️", "storm"],
  96: ["Thunderstorm with hail", "⛈️", "⛈️", "storm"],
  99: ["Severe thunderstorm with hail", "⛈️", "⛈️", "storm"],
};

const $ = (id) => document.getElementById(id);

const state = {
  location: loadSaved("gw-location") || DEFAULT_LOCATION,
  unit: loadSaved("gw-unit") || "fahrenheit",
  theme: loadSaved("gw-theme") || "system",
  name: loadSaved("gw-name") ?? DEFAULT_NAME,
};

function loadSaved(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

function describe(code, isDay = true) {
  const [text, dayIcon, nightIcon, theme] = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️", "cloudy"];
  return { text, icon: isDay ? dayIcon : nightIcon, theme };
}

// ---------- Fetching ----------

async function fetchWeather({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: [
      "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
      "precipitation", "weather_code", "wind_speed_10m", "wind_direction_10m",
    ].join(","),
    hourly: ["temperature_2m", "weather_code", "precipitation_probability", "is_day"].join(","),
    daily: [
      "weather_code", "temperature_2m_max", "temperature_2m_min",
      "sunrise", "sunset", "uv_index_max", "precipitation_probability_max",
    ].join(","),
    temperature_unit: state.unit,
    wind_speed_unit: state.unit === "fahrenheit" ? "mph" : "kmh",
    precipitation_unit: state.unit === "fahrenheit" ? "inch" : "mm",
    timezone: "auto",
    forecast_days: 7,
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  return res.json();
}

async function searchCities(query) {
  const params = new URLSearchParams({ name: query, count: 6, language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return data.results || [];
}

// ---------- Rendering ----------

// Open-Meteo returns local times like "2026-10-29T14:00" (no offset) when timezone=auto.
// Parse the parts directly so the display is in the *location's* time, not the browser's.
function parseLocal(iso) {
  const [date, time = "00:00"] = iso.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return { y, m, d, hh, mm };
}
function fmtHour(iso) {
  const { hh } = parseLocal(iso);
  const h12 = hh % 12 || 12;
  return `${h12} ${hh < 12 ? "AM" : "PM"}`;
}
function fmtClock(iso) {
  const { hh, mm } = parseLocal(iso);
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}
function fmtDay(iso, index) {
  if (index === 0) return "Today";
  const { y, m, d } = parseLocal(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}
const UNIT_LABELS = { "mp/h": "mph", "km/h": "km/h", inch: "in", mm: "mm" };
function unitLabel(u) {
  return UNIT_LABELS[u] || u;
}
function compass(deg) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

function render(data) {
  const { current, hourly, daily, current_units: units } = data;
  const loc = state.location;
  const cur = describe(current.weather_code, current.is_day === 1);
  const deg = "°";

  document.body.dataset.sky =
    cur.theme === "clear" ? (current.is_day ? "clear-day" : "clear-night") : cur.theme;

  $("place-name").textContent = loc.name;
  $("place-sub").textContent = [loc.admin1, loc.country].filter(Boolean).join(", ");
  const { y, m, d } = parseLocal(current.time);
  const dateLabel = new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  $("local-time").textContent = `${dateLabel} · ${fmtClock(current.time)} local time`;

  $("now-icon").textContent = cur.icon;
  $("now-temp").textContent = `${Math.round(current.temperature_2m)}${deg}`;
  $("now-desc").textContent = cur.text;
  $("now-hilo").textContent =
    `H: ${Math.round(daily.temperature_2m_max[0])}${deg} · L: ${Math.round(daily.temperature_2m_min[0])}${deg}`;

  $("greet-sub").textContent =
    `It's ${Math.round(current.temperature_2m)}${deg} and ${cur.text.toLowerCase()} in ${loc.name}.`;

  $("d-feels").textContent = `${Math.round(current.apparent_temperature)}${deg}`;
  $("d-humidity").textContent = `${current.relative_humidity_2m}%`;
  $("d-wind").textContent =
    `${Math.round(current.wind_speed_10m)} ${unitLabel(units.wind_speed_10m)} ${compass(current.wind_direction_10m)}`;
  $("d-uv").textContent = daily.uv_index_max[0] != null ? daily.uv_index_max[0].toFixed(1) : "--";
  $("d-precip").textContent = `${current.precipitation} ${unitLabel(units.precipitation)}`;
  $("d-sun").textContent = `☀ ${fmtClock(daily.sunrise[0])}\n☾ ${fmtClock(daily.sunset[0])}`;
  $("d-sun").style.whiteSpace = "pre-line";

  // Hourly: start at the current hour, show 24 entries
  const currentHour = current.time.slice(0, 13);
  let start = hourly.time.findIndex((t) => t.slice(0, 13) === currentHour);
  if (start < 0) start = 0;
  $("hourly").innerHTML = hourly.time.slice(start, start + 24).map((t, i) => {
    const idx = start + i;
    const w = describe(hourly.weather_code[idx], hourly.is_day[idx] === 1);
    const pop = hourly.precipitation_probability[idx];
    return `
      <div class="hour ${i === 0 ? "now-hour" : ""}">
        <span class="h-time">${i === 0 ? "Now" : fmtHour(t)}</span>
        <span class="h-icon" title="${w.text}">${w.icon}</span>
        <span class="h-temp">${Math.round(hourly.temperature_2m[idx])}${deg}</span>
        <span class="h-pop">${pop ? `💧${pop}%` : ""}</span>
      </div>`;
  }).join("");

  // Daily with a temperature range bar scaled across the week
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = weekMax - weekMin || 1;
  $("daily").innerHTML = daily.time.map((t, i) => {
    const w = describe(daily.weather_code[i]);
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const left = ((lo - weekMin) / span) * 100;
    const width = ((hi - lo) / span) * 100;
    const pop = daily.precipitation_probability_max[i];
    return `
      <li class="day">
        <span class="d-name">${fmtDay(t, i)}</span>
        <span class="d-icon" title="${w.text}">${w.icon}</span>
        <span class="d-pop">${pop ? `💧${pop}%` : ""}</span>
        <span class="range">
          <span class="lo">${Math.round(lo)}${deg}</span>
          <span class="bar"><span style="left:${left}%;width:${Math.max(width, 4)}%"></span></span>
          <span class="hi">${Math.round(hi)}${deg}</span>
        </span>
      </li>`;
  }).join("");

  $("status").hidden = true;
  $("current-content").hidden = false;
}

function showStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.hidden = false;
  $("current-content").hidden = true;
}

async function load() {
  $("unit-btn").textContent = state.unit === "fahrenheit" ? "°F" : "°C";
  updateGreeting();
  if ($("current-content").hidden) showStatus("Loading weather…");
  try {
    render(await fetchWeather(state.location));
  } catch (err) {
    console.error(err);
    showStatus("Couldn't load the weather. Check your connection and try again.", true);
  }
}

// ---------- Search with suggestions ----------

const input = $("search-input");
const list = $("suggestions");
let results = [];
let activeIndex = -1;
let debounce;

function hideSuggestions() {
  list.hidden = true;
  activeIndex = -1;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showSuggestions(items) {
  results = items;
  activeIndex = -1;
  if (!items.length) {
    list.innerHTML = `<li class="empty">No matching places</li>`;
  } else {
    list.innerHTML = items.map((r, i) => `
      <li data-index="${i}">${escapeHtml(r.name)}<small>${escapeHtml([r.admin1, r.country].filter(Boolean).join(", "))}</small></li>
    `).join("");
  }
  list.hidden = false;
}

function choose(place) {
  state.location = {
    name: place.name,
    admin1: place.admin1,
    country: place.country,
    latitude: place.latitude,
    longitude: place.longitude,
  };
  save("gw-location", state.location);
  input.value = "";
  hideSuggestions();
  input.blur();
  load();
}

input.addEventListener("input", () => {
  clearTimeout(debounce);
  const q = input.value.trim();
  if (q.length < 2) return hideSuggestions();
  debounce = setTimeout(async () => {
    try { showSuggestions(await searchCities(q)); } catch { hideSuggestions(); }
  }, 300);
});

input.addEventListener("keydown", (e) => {
  if (list.hidden || !results.length) return;
  const items = list.querySelectorAll("li[data-index]");
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = (activeIndex + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items.forEach((li, i) => li.classList.toggle("active", i === activeIndex));
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});

list.addEventListener("mousedown", (e) => {
  const li = e.target.closest("li[data-index]");
  if (li) choose(results[Number(li.dataset.index)]);
});

$("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (activeIndex >= 0 && results[activeIndex]) return choose(results[activeIndex]);
  const q = input.value.trim();
  if (!q) return;
  try {
    const found = await searchCities(q);
    if (found.length) choose(found[0]);
    else showSuggestions([]);
  } catch {
    showStatus("Search failed. Please try again.", true);
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) hideSuggestions();
});

// ---------- Units & geolocation ----------

$("unit-btn").addEventListener("click", () => {
  state.unit = state.unit === "fahrenheit" ? "celsius" : "fahrenheit";
  save("gw-unit", state.unit);
  load();
});

$("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Geolocation isn't supported by your browser.");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.location = { name: "My location", admin1: "", country: "", latitude: coords.latitude, longitude: coords.longitude };
      save("gw-location", state.location);
      load();
    },
    () => alert("Couldn't get your location. Please allow location access or search for a city.")
  );
});

// ---------- Greeting ----------

function updateGreeting() {
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
  $("greet-text").textContent = state.name ? `${part}, ${state.name}! 👋` : `${part}! 👋`;
  $("name-edit").textContent = state.name ? "Change name" : "Set your name";
}

$("name-edit").addEventListener("click", () => {
  $("name-edit").hidden = true;
  $("name-form").hidden = false;
  $("name-input").value = state.name;
  $("name-input").focus();
});

$("name-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.name = $("name-input").value.trim();
  save("gw-name", state.name);
  $("name-form").hidden = true;
  $("name-edit").hidden = false;
  updateGreeting();
});

$("name-input").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $("name-form").hidden = true;
    $("name-edit").hidden = false;
  }
});

// ---------- Theme (light / dark / system) ----------

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
  const dark = state.theme === "dark" || (state.theme === "system" && systemDark.matches);
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.setAttribute("aria-checked", String(btn.dataset.themeChoice === state.theme));
  });
}

document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.theme = btn.dataset.themeChoice;
    save("gw-theme", state.theme);
    applyTheme();
  });
});

// Follow the device setting live while "System" is selected
systemDark.addEventListener("change", () => {
  if (state.theme === "system") applyTheme();
});

applyTheme();

// Refresh every 15 minutes while the page is open
setInterval(load, 15 * 60 * 1000);

load();
