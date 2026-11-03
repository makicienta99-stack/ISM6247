/* Kamahe Allegro shop
 * - Product catalog (edit PRODUCTS below to change items, prices and photos)
 * - Bag saved in the browser (localStorage)
 * - Order by Instagram DM (copies the order text, then opens the chat)
 * - "Outfit of the day" with the free Open-Meteo weather API (no key needed)
 */
"use strict";

const INSTAGRAM = "kamaheallegro";
const DM_URL = `https://ig.me/m/${INSTAGRAM}`;
const CURRENCY = "USD";
const CART_KEY = "kamahe.cart.v1";
const CITY_KEY = "kamahe.city.v1";
const THEME_KEY = "kamahe.theme.v1";

/* ---------- Catalog ----------
 * To use a real photo, put the file in images/products/ and set photo: "images/products/name.jpg".
 * Without a photo, the site draws the garment in the selected color.
 */
const PRODUCTS = [
  { id: "tee-sol", name: "Sol Andino Tee", type: "tee", category: "tops", price: 29, tag: "Best seller",
    desc: "Classic fit t-shirt in soft 100% Peruvian cotton jersey. Light, breathable and perfect for every day.",
    colors: [["Sunset", "#fa7e1e"], ["White", "#f4f1ea"], ["Black", "#222222"]], sizes: ["XS", "S", "M", "L", "XL"], photo: "" },
  { id: "tee-rosa", name: "Rosa Lima Oversized Tee", type: "tee", category: "tops", price: 32, tag: "New",
    desc: "Oversized street fit with dropped shoulders. 100% Peruvian cotton, pre-shrunk.",
    colors: [["Pink", "#d62976"], ["Lilac", "#b89ae6"], ["Sand", "#e6d3b3"]], sizes: ["S", "M", "L", "XL"], photo: "" },
  { id: "crop-inti", name: "Inti Crop Top", type: "crop", category: "tops", price: 24, tag: "",
    desc: "Fitted crop top in stretchy cotton rib. Pairs great with our joggers.",
    colors: [["Yellow", "#f7c948"], ["White", "#f4f1ea"], ["Purple", "#962fbf"]], sizes: ["XS", "S", "M", "L"], photo: "" },
  { id: "ls-cusco", name: "Cusco Long Sleeve", type: "longsleeve", category: "tops", price: 36, tag: "",
    desc: "Long sleeve tee for cool mornings and AC classrooms. Midweight Peruvian cotton.",
    colors: [["Blue", "#4f5bd5"], ["Olive", "#7b8b4f"], ["Black", "#222222"]], sizes: ["S", "M", "L", "XL"], photo: "" },
  { id: "hood-andes", name: "Andes Hoodie", type: "hoodie", category: "hoodies", price: 58, tag: "Best seller",
    desc: "Heavy, cozy hoodie in brushed 100% Peruvian cotton fleece with kangaroo pocket.",
    colors: [["Purple", "#962fbf"], ["Gray", "#9a9aa2"], ["Black", "#222222"]], sizes: ["S", "M", "L", "XL", "XXL"], photo: "" },
  { id: "hood-allegro", name: "Allegro Gradient Hoodie", type: "hoodie", category: "hoodies", price: 64, tag: "Limited",
    desc: "Our signature hoodie in sunset colors. Limited drop, made in small batches.",
    colors: [["Sunset", "#e9456f"], ["Ocean", "#4f5bd5"]], sizes: ["S", "M", "L", "XL"], photo: "" },
  { id: "jog-vibe", name: "Vibe Joggers", type: "joggers", category: "bottoms", price: 48, tag: "",
    desc: "Relaxed joggers with elastic cuffs and deep pockets. 100% Peruvian cotton french terry.",
    colors: [["Black", "#222222"], ["Gray", "#9a9aa2"], ["Lilac", "#b89ae6"]], sizes: ["XS", "S", "M", "L", "XL"], photo: "" },
  { id: "short-playa", name: "Playa Shorts", type: "shorts", category: "bottoms", price: 30, tag: "New",
    desc: "Soft cotton shorts for hot days, beach plans and chill weekends.",
    colors: [["Sand", "#e6d3b3"], ["Pink", "#d62976"], ["Blue", "#4f5bd5"]], sizes: ["S", "M", "L", "XL"], photo: "" },
  { id: "set-allegro", name: "Allegro Matching Set", type: "set", category: "sets", price: 74, tag: "Save $10",
    desc: "Oversized tee + Vibe joggers in the same color. The easiest outfit ever.",
    colors: [["Lilac", "#b89ae6"], ["Sunset", "#fa7e1e"], ["Black", "#222222"]], sizes: ["S", "M", "L", "XL"], photo: "" },
];

const CATEGORIES = [
  ["all", "All", "✨"], ["tops", "Tops", "👕"], ["hoodies", "Hoodies", "🧥"],
  ["bottoms", "Bottoms", "👖"], ["sets", "Sets", "🎽"],
];

const CITIES = [
  { id: "boca", name: "Boca Raton, FL", lat: 26.3683, lon: -80.1289, unit: "fahrenheit", tz: "America/New_York" },
  { id: "miami", name: "Miami, FL", lat: 25.7617, lon: -80.1918, unit: "fahrenheit", tz: "America/New_York" },
  { id: "orlando", name: "Orlando, FL", lat: 28.5383, lon: -81.3792, unit: "fahrenheit", tz: "America/New_York" },
  { id: "nyc", name: "New York, NY", lat: 40.7128, lon: -74.006, unit: "fahrenheit", tz: "America/New_York" },
  { id: "lima", name: "Lima, Perú", lat: -12.0464, lon: -77.0428, unit: "celsius", tz: "America/Lima" },
  { id: "cusco", name: "Cusco, Perú", lat: -13.5319, lon: -71.9675, unit: "celsius", tz: "America/Lima" },
  { id: "arequipa", name: "Arequipa, Perú", lat: -16.409, lon: -71.5375, unit: "celsius", tz: "America/Lima" },
];

// WMO weather codes -> [description, emoji]
const WEATHER = {
  0: ["Clear sky", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Cloudy", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"], 61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"], 66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"], 71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"], 80: ["Showers", "🌦️"], 81: ["Showers", "🌧️"],
  82: ["Strong showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"], 95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm", "⛈️"], 99: ["Thunderstorm", "⛈️"],
};

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const money = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY }).format(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const byId = (id) => PRODUCTS.find((p) => p.id === id);

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Garment drawings (used until real photos are added) ---------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const SHAPES = {
  tee: (c, d) => `<path d="M70 40l-36 18 12 30 16-7v79h76V81l16 7 12-30-36-18c-4 12-16 20-30 20s-26-8-30-20z" fill="${c}"/>
    <path d="M70 40c4 12 16 20 30 20s26-8 30-20" fill="none" stroke="${d}" stroke-width="4"/>`,
  crop: (c, d) => `<path d="M74 46l-30 14 10 24 14-6v52h64V78l14 6 10-24-30-14c-4 10-14 16-26 16s-22-6-26-16z" fill="${c}"/>
    <path d="M68 118h64" stroke="${d}" stroke-width="5"/>`,
  longsleeve: (c, d) => `<path d="M70 40L40 54 22 140l20 4 22-62v78h72V84l22 60 20-4-18-86-30-14c-4 12-16 20-30 20s-26-8-30-20z" fill="${c}"/>
    <path d="M70 40c4 12 16 20 30 20s26-8 30-20" fill="none" stroke="${d}" stroke-width="4"/>`,
  hoodie: (c, d) => `<path d="M72 44L40 58 22 146l20 4 22-62v76h72V88l22 62 20-4-18-88-32-14z" fill="${c}"/>
    <path d="M72 44c0-18 12-28 28-28s28 10 28 28c-6 12-16 18-28 18s-22-6-28-18z" fill="${d}"/>
    <path d="M78 124h44l6 26H72z" fill="${d}" opacity=".55"/>
    <path d="M94 62v22M106 62v22" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  joggers: (c, d) => `<path d="M64 30h72l8 140h-30l-14-96-14 96H56z" fill="${c}"/>
    <path d="M64 30h72v12H64z" fill="${d}"/>
    <path d="M56 160h30v10H56zM114 160h30v10h-30z" fill="${d}"/>`,
  shorts: (c, d) => `<path d="M58 54h84l10 80h-40l-12-44-12 44H48z" fill="${c}"/>
    <path d="M58 54h84v12H58z" fill="${d}"/>
    <path d="M96 66v14" stroke="#fff" stroke-width="3" opacity=".8"/>`,
  set: (c, d) => `<g transform="translate(-28 -6) scale(.78)"><path d="M70 40l-36 18 12 30 16-7v79h76V81l16 7 12-30-36-18c-4 12-16 20-30 20s-26-8-30-20z" fill="${c}"/></g>
    <g transform="translate(70 30) scale(.72)"><path d="M64 30h72l8 140h-30l-14-96-14 96H56z" fill="${c}"/><path d="M64 30h72v12H64z" fill="${d}"/></g>`,
};

function garmentSVG(product, colorIndex = 0, bgSeed = 0) {
  const hex = product.colors[colorIndex][1];
  const dark = shade(hex, -40);
  const bgs = [["#fff3e0", "#ffe0ef"], ["#fde4f0", "#ece6ff"], ["#ece6ff", "#e3f0ff"], ["#fff8d6", "#ffe3d3"]];
  const [b1, b2] = bgs[bgSeed % bgs.length];
  const gid = `g${product.id}${colorIndex}${bgSeed}`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(product.name)}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${gid})"/>
    <path d="M0 182h20v-8h14v-8h14v8h14v8h16v-8h14v-8h14v8h14v8h16v-8h14v-8h14v8h14v8h8v18H0z" fill="${hex}" opacity=".18"/>
    <g transform="translate(0 6)">${SHAPES[product.type](hex, dark)}</g>
  </svg>`;
}

function media(product, colorIndex = 0, seed = 0) {
  if (product.photo) return `<img src="${esc(product.photo)}" alt="${esc(product.name)}" loading="lazy" />`;
  return garmentSVG(product, colorIndex, seed);
}

/* ---------- Shop grid ---------- */
let activeCategory = "all";

function renderFilters() {
  $("#filters").innerHTML = CATEGORIES.map(([id, label]) =>
    `<button class="chip ${id === activeCategory ? "active" : ""}" data-cat="${id}" role="tab" aria-selected="${id === activeCategory}">${label}</button>`
  ).join("");
  $("#highlights").innerHTML = CATEGORIES.map(([id, label, emoji]) =>
    `<button class="highlight" data-cat="${id}"><span class="story-ring"><span class="bubble">${emoji}</span></span>${label}</button>`
  ).join("");
}

function renderGrid() {
  const list = PRODUCTS.filter((p) => activeCategory === "all" || p.category === activeCategory);
  $("#product-grid").innerHTML = list.map((p, i) => `
    <article class="card">
      <button class="card-media" data-open="${p.id}" aria-label="View ${esc(p.name)}">
        ${media(p, 0, i)}
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
      </button>
      <div class="card-body">
        <h3 class="card-title">${esc(p.name)}</h3>
        <p class="card-meta">100% Peruvian cotton</p>
        <div class="swatches">${p.colors.map(([n, h]) => `<span class="swatch" style="background:${h}" title="${esc(n)}"></span>`).join("")}</div>
        <div class="card-foot">
          <span class="price">${money(p.price)}</span>
          <button class="add-btn" data-open="${p.id}">Choose size</button>
        </div>
      </div>
    </article>`).join("");
}

function setCategory(cat) {
  activeCategory = cat;
  renderFilters();
  renderGrid();
}

/* ---------- Product modal ---------- */
function openProduct(id) {
  const p = byId(id);
  if (!p) return;
  let color = 0;
  let size = "";
  const body = $("#modal-body");

  const draw = () => {
    body.innerHTML = `
      <div class="modal-media">${media(p, color, 1)}</div>
      <div class="modal-info">
        ${p.tag ? `<span class="eyebrow">${esc(p.tag)}</span>` : ""}
        <h2>${esc(p.name)}</h2>
        <span class="price">${money(p.price)}</span>
        <p class="muted">${esc(p.desc)}</p>
        <span class="opt-label">Color: ${esc(p.colors[color][0])}</span>
        <div class="opt-row">${p.colors.map(([n, h], i) =>
          `<button class="opt opt-color ${i === color ? "active" : ""}" data-color="${i}" style="background:${h}" aria-label="${esc(n)}" title="${esc(n)}"></button>`).join("")}</div>
        <span class="opt-label">Size ${size ? `: ${size}` : ""}</span>
        <div class="opt-row">${p.sizes.map((s) => `<button class="opt ${s === size ? "active" : ""}" data-size="${s}">${s}</button>`).join("")}</div>
        <button class="btn btn-grad full" id="modal-add" ${size ? "" : "disabled"}>${size ? "Add to bag" : "Pick a size"}</button>
        <p class="tiny muted">🌿 100% Peruvian cotton · Wash cold, dry low.</p>
      </div>`;
  };

  body.onclick = (e) => {
    const c = e.target.closest("[data-color]");
    const s = e.target.closest("[data-size]");
    if (c) { color = Number(c.dataset.color); draw(); }
    if (s) { size = s.dataset.size; draw(); }
    if (e.target.id === "modal-add" && size) {
      addToCart(p.id, color, size);
      $("#product-modal").close();
    }
  };

  draw();
  $("#product-modal").showModal();
}

/* ---------- Cart ---------- */
let cart = Array.isArray(store(CART_KEY)) ? store(CART_KEY) : [];
cart = cart.filter((l) => byId(l.id));

function saveCart() { store(CART_KEY, cart); renderCart(); }

function addToCart(id, color, size) {
  const line = cart.find((l) => l.id === id && l.color === color && l.size === size);
  if (line) line.qty += 1;
  else cart.push({ id, color, size, qty: 1 });
  saveCart();
  toast(`Added ${byId(id).name} (${size}) to your bag 🛍️`);
}

function cartTotal() { return cart.reduce((sum, l) => sum + byId(l.id).price * l.qty, 0); }

function renderCart() {
  const count = cart.reduce((n, l) => n + l.qty, 0);
  $("#cart-count").textContent = count;
  $("#cart-total").textContent = money(cartTotal());
  $("#checkout-btn").disabled = count === 0;
  $("#drawer-items").innerHTML = count === 0
    ? `<p class="empty">Your bag is empty.<br/>Find something you love 💖</p>`
    : cart.map((l, i) => {
      const p = byId(l.id);
      return `<div class="line">
        <div class="line-media">${media(p, l.color, 2)}</div>
        <div><p><b>${esc(p.name)}</b></p><p class="muted">${esc(p.colors[l.color][0])} · ${l.size}</p><p>${money(p.price * l.qty)}</p></div>
        <div class="qty"><button data-dec="${i}" aria-label="Less">−</button><span>${l.qty}</span><button data-inc="${i}" aria-label="More">+</button></div>
      </div>`;
    }).join("");
}

function openDrawer(open) {
  $("#drawer").classList.toggle("open", open);
  $("#drawer").setAttribute("aria-hidden", String(!open));
  $("#backdrop").hidden = !open;
}

function orderText() {
  const lines = cart.map((l) => {
    const p = byId(l.id);
    return `• ${l.qty} x ${p.name} – ${p.colors[l.color][0]} – size ${l.size} – ${money(p.price * l.qty)}`;
  });
  return `Hi Kamahe Allegro! 💖 I want to order:\n${lines.join("\n")}\nSubtotal: ${money(cartTotal())}\nMy name / city:`;
}

async function checkout() {
  const text = orderText();
  let copied = false;
  try { await navigator.clipboard.writeText(text); copied = true; } catch { /* clipboard blocked */ }
  if (copied) {
    toast("Order copied! Paste it in our Instagram chat 📸");
    window.open(DM_URL, "_blank", "noopener");
  } else {
    window.prompt("Copy your order and send it to @kamaheallegro on Instagram:", text);
    window.open(DM_URL, "_blank", "noopener");
  }
}

/* ---------- Weather (Open-Meteo) ---------- */
function picksFor(maxC, rain) {
  if (maxC >= 27) return { title: "Hot day = light cotton ☀️", text: "Go for a breathable tee, a crop top or shorts. Peruvian cotton keeps you fresh.", cats: ["tee", "crop", "shorts"] };
  if (maxC >= 20) return { title: "Nice weather 😎", text: "A tee with joggers, or a long sleeve for the AC. Easy and comfy.", cats: ["tee", "longsleeve", "joggers", "set"] };
  return { title: "Cool day = cozy 🧥", text: "Time for a hoodie and joggers. Soft cotton fleece keeps you warm.", cats: ["hoodie", "joggers", "longsleeve"], rain };
}

async function loadWeather(city) {
  const now = $("#weather-now");
  now.innerHTML = `<span class="w-icon">⏳</span><span class="w-text">Loading weather for ${esc(city.name)}…</span>`;
  $("#forecast").innerHTML = "";
  const params = new URLSearchParams({
    latitude: city.lat, longitude: city.lon,
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: city.unit, timezone: city.tz, forecast_days: 5,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const u = city.unit === "fahrenheit" ? "°F" : "°C";
    const [desc, icon] = WEATHER[data.current.weather_code] || ["—", "🌡️"];
    now.innerHTML = `<span class="w-icon">${icon}</span>
      <div><div class="w-temp">${Math.round(data.current.temperature_2m)}${u}</div>
      <div class="w-text">${desc} · feels like ${Math.round(data.current.apparent_temperature)}${u}</div></div>`;

    $("#forecast").innerHTML = data.daily.time.map((day, i) => {
      const [, fi] = WEATHER[data.daily.weather_code[i]] || ["", "🌡️"];
      const name = i === 0 ? "Today" : new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
      return `<div class="fday"><b>${name}</b><div class="fi">${fi}</div>${Math.round(data.daily.temperature_2m_max[i])}° / ${Math.round(data.daily.temperature_2m_min[i])}°</div>`;
    }).join("");

    const max = data.daily.temperature_2m_max[0];
    const maxC = city.unit === "fahrenheit" ? (max - 32) * 5 / 9 : max;
    const rain = data.daily.precipitation_probability_max[0] ?? 0;
    const pick = picksFor(maxC, rain);
    $("#pick-title").textContent = pick.title;
    $("#pick-text").textContent = pick.text + (rain >= 50 ? ` Rain chance is ${rain}%, so bring a hoodie just in case ☔` : "");
    const items = PRODUCTS.filter((p) => pick.cats.includes(p.type)).slice(0, 4);
    $("#pick-grid").innerHTML = items.map((p, i) =>
      `<button class="mini" data-open="${p.id}"><div class="mini-media">${media(p, 0, i + 1)}</div><span>${esc(p.name)} · ${money(p.price)}</span></button>`
    ).join("");
  } catch {
    now.innerHTML = `<span class="w-icon">🌈</span><span class="w-text">Weather is not available right now. Our pick: a soft tee and joggers!</span>`;
    $("#pick-grid").innerHTML = PRODUCTS.filter((p) => ["tee", "joggers"].includes(p.type)).slice(0, 3)
      .map((p, i) => `<button class="mini" data-open="${p.id}"><div class="mini-media">${media(p, 0, i)}</div><span>${esc(p.name)}</span></button>`).join("");
  }
}

function setupWeather() {
  const sel = $("#city-select");
  sel.innerHTML = CITIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const saved = store(CITY_KEY);
  sel.value = CITIES.some((c) => c.id === saved) ? saved : "boca";
  sel.onchange = () => { store(CITY_KEY, sel.value); loadWeather(CITIES.find((c) => c.id === sel.value)); };
  loadWeather(CITIES.find((c) => c.id === sel.value));
}

/* ---------- Instagram-style grid + hero cards ---------- */
function renderFeed() {
  const tiles = [];
  for (let i = 0; i < 6; i++) {
    const p = PRODUCTS[(i * 2) % PRODUCTS.length];
    tiles.push(`<a href="https://www.instagram.com/${INSTAGRAM}/" target="_blank" rel="noopener" aria-label="See ${esc(p.name)} on Instagram">${media(p, i % p.colors.length, i)}</a>`);
  }
  $("#ig-grid").innerHTML = tiles.join("");
  $("#hero-card-1").innerHTML = media(PRODUCTS[4], 0, 0);
  $("#hero-card-2").innerHTML = media(PRODUCTS[1], 0, 2);
}

/* ---------- Theme ---------- */
function setupTheme() {
  const btn = $("#theme-btn");
  const apply = (t) => {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    btn.textContent = dark ? "☀️" : "🌙";
  };
  apply(store(THEME_KEY));
  btn.onclick = () => {
    const isDark = btn.textContent === "☀️";
    const next = isDark ? "light" : "dark";
    store(THEME_KEY, next);
    apply(next);
  };
}

/* ---------- Events ---------- */
document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]");
  if (open) return openProduct(open.dataset.open);
  const cat = e.target.closest("[data-cat]");
  if (cat) {
    setCategory(cat.dataset.cat);
    if (cat.classList.contains("highlight")) $("#shop").scrollIntoView({ behavior: "smooth" });
    return;
  }
  const inc = e.target.closest("[data-inc]");
  const dec = e.target.closest("[data-dec]");
  if (inc) { cart[inc.dataset.inc].qty += 1; saveCart(); }
  if (dec) {
    const i = Number(dec.dataset.dec);
    cart[i].qty -= 1;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    saveCart();
  }
});

$("#cart-btn").onclick = () => openDrawer(true);
$("#drawer-close").onclick = () => openDrawer(false);
$("#backdrop").onclick = () => openDrawer(false);
$("#checkout-btn").onclick = checkout;
$("#clear-btn").onclick = () => { cart = []; saveCart(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") openDrawer(false); });

$("#product-modal").addEventListener("click", (e) => {
  if (e.target === $("#product-modal")) $("#product-modal").close();
});

$("#year").textContent = new Date().getFullYear();

setupTheme();
renderFilters();
renderGrid();
renderCart();
renderFeed();
setupWeather();
