// Owl Deadlines — organize Canvas deadlines for FAU students.
// Data: Canvas calendar feed (.ics) via a Netlify function, or an uploaded .ics file.
// Weather: Open-Meteo API (free, no key). Everything is stored in this browser (localStorage).

"use strict";

// ---------- Constants ----------

const CAMPUSES = {
  boca:    { name: "Boca Raton",       latitude: 26.3727, longitude: -80.1019 },
  jupiter: { name: "Jupiter",          latitude: 26.8889, longitude: -80.1160 },
  davie:   { name: "Davie",            latitude: 26.0822, longitude: -80.2367 },
  ftl:     { name: "Fort Lauderdale",  latitude: 26.1197, longitude: -80.1434 },
  hbo:     { name: "Harbor Branch",    latitude: 27.5353, longitude: -80.3550 },
};
const DEFAULT_CAMPUS = "boca";
const TIMEZONE = "America/New_York";

const TYPES = {
  homework: { label: "Homework", color: "#0770a3", icon: "📝" },
  project:  { label: "Project",  color: "#8f3e97", icon: "📊" },
  quiz:     { label: "Quiz",     color: "#e66000", icon: "❓" },
  exam:     { label: "Exam",     color: "#cc0000", icon: "🎓" },
  event:    { label: "Event",    color: "#6b7780", icon: "📌" },
};

// Canvas-like course card colors
const COURSE_COLORS = ["#003366", "#cc0000", "#0b874b", "#8f3e97", "#0770a3", "#e66000", "#127a1b", "#bf32a4", "#1c5d99", "#5e6a71"];

const WEATHER = {
  0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Fog", "🌫️"],
  51: ["Drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Drizzle", "🌧️"], 56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"], 66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow", "🌨️"],
  80: ["Showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Heavy showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm", "⛈️"], 99: ["Thunderstorm", "⛈️"],
};

const FEED_ENDPOINT = "/api/canvas-feed";
const AUTO_SYNC_MS = 60 * 60 * 1000; // re-sync at most once an hour on load
const DAY = 86400000;

// ---------- Storage ----------

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const state = {
  items: load("od-items", []),
  prefs: Object.assign({ name: "", campus: DEFAULT_CAMPUS, feedUrl: "", lastSync: 0, includeEvents: false }, load("od-prefs", {})),
  weather: {},          // "YYYY-MM-DD" -> { code, max, min, rain }
  filters: { search: "", course: "", range: "", showDone: false, types: new Set() },
  calMonth: startOfMonth(new Date()),
  editingId: null,
};
if (!CAMPUSES[state.prefs.campus]) state.prefs.campus = DEFAULT_CAMPUS;

const persistItems = () => save("od-items", state.items);
const persistPrefs = () => save("od-prefs", state.prefs);

// ---------- Helpers ----------

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
const uid = () => "m-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
function fmtDate(d, opts) { return new Date(d).toLocaleDateString("en-US", opts || { weekday: "short", month: "short", day: "numeric" }); }
function fmtTime(d) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

function courseColor(course) {
  if (!course) return "#5e6a71";
  let h = 0;
  for (const ch of course) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COURSE_COLORS[h % COURSE_COLORS.length];
}

function shortCourse(course) {
  if (!course) return "No course";
  // "ISM6247-001 Fall 2026 Business Innovation" -> keep it readable but short
  const m = course.match(/[A-Z]{3}\s?\d{4}[A-Z]?/);
  return m ? m[0].replace(" ", "") : course.length > 28 ? course.slice(0, 26) + "…" : course;
}

function guessType(title, isAssignment) {
  const t = (title || "").toLowerCase();
  if (/\bquiz(zes)?\b/.test(t)) return "quiz";
  if (/\b(project|presentation|paper|case study|report|proposal|capstone|portfolio|essay|research)\b/.test(t)) return "project";
  if (/\b(exam|midterm|mid-term|final|test)\b/.test(t)) return "exam";
  if (isAssignment === false) return "event";
  return "homework";
}

function relative(due) {
  const diff = new Date(due) - Date.now();
  const abs = Math.abs(diff);
  const d = Math.floor(abs / DAY), h = Math.floor((abs % DAY) / 3600000), m = Math.floor((abs % 3600000) / 60000);
  const txt = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff < 0 ? `Overdue by ${txt}` : `Due in ${txt}`;
}

function toast(msg, ms = 3200) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

// ---------- ICS parsing (Canvas calendar feed) ----------

function parseIcsDate(value, params) {
  // value: 20261105T035900Z | 20261104T235900 | 20261105 (VALUE=DATE)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, z] = m;
  if (!hh) return { date: new Date(+y, +mo - 1, +d, 23, 59), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +(ss || 0))), allDay: false };
  // Floating or TZID time — FAU Canvas uses America/New_York, same as the student's clock
  return { date: new Date(+y, +mo - 1, +d, +hh, +mi, +(ss || 0)), allDay: false, tz: params.TZID };
}

function unescapeIcs(s) {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function parseIcs(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events = [];
  let ev = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { ev = {}; continue; }
    if (line === "END:VEVENT") { if (ev) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const [name, ...rawParams] = line.slice(0, idx).split(";");
    const params = Object.fromEntries(rawParams.map((p) => p.split("=")));
    const value = line.slice(idx + 1);
    const key = name.toUpperCase();
    if (key === "DTSTART" || key === "DTEND") ev[key] = parseIcsDate(value, params);
    else ev[key] = unescapeIcs(value);
  }

  return events
    .filter((e) => e.SUMMARY && (e.DTSTART || e.DTEND))
    .map((e) => {
      const isAssignment = /assignment/i.test(e.UID || "") || /assignment/i.test(e.URL || "");
      let title = e.SUMMARY.trim();
      let course = "";
      const m = title.match(/^(.*)\s\[([^\]]+)\]\s*$/); // Canvas: "Title [Course Name]"
      if (m) { title = m[1].trim(); course = m[2].trim(); }
      const when = e.DTSTART || e.DTEND;
      return {
        uid: e.UID || `${title}-${when.date.toISOString()}`,
        title,
        course,
        type: guessType(title, isAssignment),
        isAssignment,
        due: when.date.toISOString(),
        allDay: when.allDay,
        url: safeUrl(e.URL || ""),
        notes: (e.DESCRIPTION || "").slice(0, 2000),
      };
    });
}

function mergeCanvas(parsed) {
  const keep = parsed.filter((p) => state.prefs.includeEvents || p.isAssignment || p.type !== "event");
  const old = new Map(state.items.filter((i) => i.source === "canvas").map((i) => [i.uid, i]));
  const fresh = keep.map((p) => {
    const prev = old.get(p.uid);
    return {
      id: prev?.id || "c-" + p.uid,
      uid: p.uid,
      source: "canvas",
      title: p.title,
      course: p.course,
      type: prev?.typeEdited ? prev.type : p.type,
      typeEdited: !!prev?.typeEdited,
      due: p.due,
      allDay: p.allDay,
      url: p.url,
      notes: prev?.notesEdited ? prev.notes : p.notes,
      notesEdited: !!prev?.notesEdited,
      done: !!prev?.done,
    };
  });
  const added = fresh.filter((f) => !old.has(f.uid)).length;
  // Real Canvas data replaces any sample deadlines
  state.items = state.items.filter((i) => i.source !== "canvas" && i.source !== "demo").concat(fresh);
  persistItems();
  return { total: fresh.length, added };
}

// ---------- Canvas sync ----------

async function syncCanvas({ silent = false } = {}) {
  const url = state.prefs.feedUrl;
  if (!url) {
    if (!silent) { location.hash = "#sync"; toast("Paste your Canvas calendar feed link first."); }
    return;
  }
  const btn = $("sync-btn");
  btn.disabled = true;
  $("sync-status").textContent = "Syncing with Canvas…";
  try {
    const res = await fetch(`${FEED_ENDPOINT}?url=${encodeURIComponent(url)}`);
    const body = await res.text();
    if (!res.ok) throw new Error(body.slice(0, 200) || `HTTP ${res.status}`);
    if (!body.includes("BEGIN:VCALENDAR")) throw new Error("The link did not return a calendar. Check that you copied the Calendar Feed link.");
    const { total, added } = mergeCanvas(parseIcs(body));
    state.prefs.lastSync = Date.now();
    persistPrefs();
    renderAll();
    if (!silent || added) toast(`Canvas synced: ${total} deadlines${added ? `, ${added} new` : ""}.`);
  } catch (err) {
    const msg = location.protocol === "file:" || /Failed to fetch|404/.test(err.message)
      ? "Sync needs the Netlify function (deploy via Git). Meanwhile, upload the .ics file below."
      : err.message;
    $("sync-status").textContent = "⚠️ " + msg;
    if (!silent) toast("Sync failed — see Canvas Sync page.");
  } finally {
    btn.disabled = false;
    renderSyncStatus();
  }
}

function renderSyncStatus() {
  const el = $("sync-status");
  if (el.textContent.startsWith("⚠️")) return;
  el.textContent = state.prefs.lastSync
    ? `Last synced ${fmtDate(state.prefs.lastSync)} at ${fmtTime(state.prefs.lastSync)}.`
    : state.prefs.feedUrl ? "Not synced yet." : "No feed connected.";
}

// ---------- Weather (Open-Meteo) ----------

async function loadWeather() {
  const campus = CAMPUSES[state.prefs.campus];
  $("w-campus").textContent = campus.name;
  const params = new URLSearchParams({
    latitude: campus.latitude,
    longitude: campus.longitude,
    current: "temperature_2m,weather_code,apparent_temperature",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: TIMEZONE,
    forecast_days: "16",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    state.weather = {};
    data.daily.time.forEach((day, i) => {
      state.weather[day] = {
        code: data.daily.weather_code[i],
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
        rain: data.daily.precipitation_probability_max[i] ?? 0,
      };
    });
    const [desc, icon] = WEATHER[data.current.weather_code] || ["—", "🌡️"];
    $("w-now").innerHTML = `<span class="big">${icon}</span><div><div class="temp">${Math.round(data.current.temperature_2m)}°F</div><div class="muted small">${esc(desc)} · feels ${Math.round(data.current.apparent_temperature)}°</div></div>`;
    $("w-days").innerHTML = data.daily.time.slice(0, 5).map((day, i) => {
      const w = state.weather[day];
      const label = i === 0 ? "Today" : fmtDate(day + "T12:00", { weekday: "short" });
      return `<div title="${esc((WEATHER[w.code] || ["—"])[0])}, ${w.rain}% rain"><b>${label}</b><span class="ico">${(WEATHER[w.code] || ["", "🌡️"])[1]}</span>${w.max}°/${w.min}°</div>`;
    }).join("");
    renderAll();
  } catch {
    $("w-now").textContent = "Weather unavailable right now.";
  }
}

function wxFor(due) {
  const w = state.weather[dayKey(due)];
  if (!w) return "";
  const [desc, icon] = WEATHER[w.code] || ["", "🌡️"];
  return `<span class="wx" title="${esc(desc)} at ${esc(CAMPUSES[state.prefs.campus].name)} campus">${icon} ${w.max}°${w.rain >= 30 ? ` · ${w.rain}% 💧` : ""}</span>`;
}

// ---------- Derived data ----------

function categorize(item, now = new Date()) {
  const due = new Date(item.due);
  const today = startOfDay(now);
  if (item.done) return "done";
  if (due < now) return "overdue";
  if (due < new Date(+today + DAY)) return "today";
  if (due < new Date(+today + 2 * DAY)) return "tomorrow";
  if (due < new Date(+today + 7 * DAY)) return "week";
  return "later";
}

function courses() {
  const map = new Map();
  for (const it of state.items) {
    const key = it.course || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function filtered() {
  const f = state.filters;
  const now = new Date();
  const q = f.search.trim().toLowerCase();
  return state.items
    .filter((it) => {
      if (!f.showDone && it.done) return false;
      if (f.course && (it.course || "") !== f.course) return false;
      if (f.types.size && !f.types.has(it.type)) return false;
      if (q && !`${it.title} ${it.course} ${it.notes}`.toLowerCase().includes(q)) return false;
      if (f.range) {
        const due = new Date(it.due), cat = categorize({ ...it, done: false }, now);
        if (f.range === "overdue" && cat !== "overdue") return false;
        if (f.range === "today" && cat !== "today") return false;
        if (f.range === "week" && !(due >= now && due < new Date(+now + 7 * DAY))) return false;
        if (f.range === "month" && !(due >= now && due < new Date(+now + 30 * DAY))) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.due) - new Date(b.due));
}

// ---------- Rendering ----------

function itemRow(it) {
  const t = TYPES[it.type] || TYPES.homework;
  const due = new Date(it.due);
  const cat = categorize(it);
  const rel = it.done ? "Completed" : relative(it.due);
  const relCls = cat === "overdue" ? "due-late" : cat === "today" || cat === "tomorrow" ? "due-soon" : "";
  const url = safeUrl(it.url);
  const titleHtml = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(it.title)}</a>` : esc(it.title);
  return `
    <div class="item ${it.done ? "done" : ""}" data-id="${esc(it.id)}">
      <input type="checkbox" data-toggle="${esc(it.id)}" ${it.done ? "checked" : ""} aria-label="Mark ${esc(it.title)} complete" />
      <span class="stripe" style="background:${t.color}"></span>
      <div class="item-main">
        <p class="item-title">${titleHtml}</p>
        <div class="item-meta">
          <span class="badge" style="background:${t.color}">${t.icon} ${t.label}</span>
          <span class="course-chip"><span class="dot" style="background:${courseColor(it.course)}"></span>${esc(shortCourse(it.course))}</span>
          <span>${fmtDate(due)}${it.allDay ? "" : " · " + fmtTime(due)}</span>
          <span class="${relCls}">${rel}</span>
          ${it.source === "canvas" ? '<span title="Imported from Canvas">🔄 Canvas</span>' : it.source === "demo" ? '<span title="Sample data">👀 Sample</span>' : ""}
        </div>
      </div>
      <div class="item-side">
        ${wxFor(it.due)}
        <button class="icon-btn" data-edit="${esc(it.id)}" aria-label="Edit ${esc(it.title)}" title="Edit">✏️</button>
      </div>
    </div>`;
}

function renderTodo() {
  const list = filtered();
  const groups = { overdue: [], today: [], tomorrow: [], week: [], later: [], done: [] };
  list.forEach((it) => groups[categorize(it)].push(it));
  groups.done.reverse();
  const labels = { overdue: "Overdue", today: "Today", tomorrow: "Tomorrow", week: "This week", later: "Later", done: "Completed" };
  const html = Object.entries(groups)
    .filter(([, arr]) => arr.length)
    .map(([k, arr]) => `<div class="group-title ${k === "overdue" ? "overdue" : ""}"><span>${labels[k]}</span><span>${arr.length}</span></div>${arr.map(itemRow).join("")}`)
    .join("");
  $("todo-list").innerHTML = html || `<p class="empty">Nothing here 🎉 ${state.items.length ? "Try changing the filters." : 'Import from <a href="#sync">Canvas Sync</a> or add a deadline.'}</p>`;
}

function renderFilters() {
  const sel = $("f-course");
  const current = state.filters.course;
  sel.innerHTML = '<option value="">All courses</option>' +
    courses().map(([c]) => `<option value="${esc(c)}">${esc(c ? shortCourse(c) + (shortCourse(c) !== c ? " — " + c : "") : "No course")}</option>`).join("");
  sel.value = current;
  $("course-list").innerHTML = courses().filter(([c]) => c).map(([c]) => `<option value="${esc(c)}"></option>`).join("");

  $("f-types").innerHTML = Object.entries(TYPES).map(([k, t]) => {
    const n = state.items.filter((i) => i.type === k && !i.done).length;
    return `<button class="chip" type="button" data-type="${k}" aria-pressed="${state.filters.types.has(k)}"><span class="dot" style="background:${t.color}"></span>${t.label} (${n})</button>`;
  }).join("");
}

function courseCardHtml(course, items) {
  const open = items.filter((i) => !i.done).sort((a, b) => new Date(a.due) - new Date(b.due));
  const upcoming = open.filter((i) => new Date(i.due) >= new Date());
  const next = upcoming[0];
  const color = courseColor(course);
  const counts = Object.keys(TYPES).map((k) => [k, open.filter((i) => i.type === k).length]).filter(([, n]) => n);
  return `
    <button class="course-card" type="button" data-course="${esc(course)}">
      <div class="course-hero" style="background:${color}">
        <span class="count">${open.length} open</span>
        ${next ? `<span class="next">Next: ${esc(next.title.slice(0, 40))} · ${fmtDate(next.due, { month: "short", day: "numeric" })}</span>` : '<span class="next">All caught up ✓</span>'}
      </div>
      <div class="course-body">
        <p class="course-name" style="color:${color}">${esc(shortCourse(course))}</p>
        <p class="course-meta">${esc(course || "Personal / no course")}</p>
        <div class="course-bar">${counts.map(([k, n]) => `<span style="background:${TYPES[k].color}">${n} ${TYPES[k].label}</span>`).join("")}</div>
      </div>
    </button>`;
}

function renderDashboard() {
  const now = new Date();
  const open = state.items.filter((i) => !i.done);
  const cats = open.map((i) => categorize(i, now));
  const week = open.filter((i) => { const d = new Date(i.due); return d >= now && d < new Date(+now + 7 * DAY); }).length;
  $("s-overdue").textContent = cats.filter((c) => c === "overdue").length;
  $("s-today").textContent = cats.filter((c) => c === "today").length;
  $("s-week").textContent = week;
  $("s-exams").textContent = open.filter((i) => i.type === "exam" && new Date(i.due) >= now).length;

  const name = state.prefs.name.trim() || "Owl";
  const hr = now.getHours();
  $("greet").textContent = `${hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"}, ${name}! 🦉`;
  const nextExam = open.filter((i) => i.type === "exam" && new Date(i.due) >= now).sort((a, b) => new Date(a.due) - new Date(b.due))[0];
  $("greet-sub").textContent = nextExam
    ? `Next exam: ${nextExam.title} (${shortCourse(nextExam.course)}) — ${relative(nextExam.due).toLowerCase()}.`
    : `${fmtDate(now, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · Go Owls!`;

  $("type-breakdown").innerHTML = Object.entries(TYPES).map(([k, t]) => {
    const n = open.filter((i) => i.type === k).length;
    return n || k !== "event" ? `<span class="type-pill"><span class="dot" style="background:${t.color}"></span>${t.label}: <b>${n}</b></span>` : "";
  }).join("");

  const list = courses();
  $("dash-cards").innerHTML = list.map(([c, items]) => courseCardHtml(c, items)).join("");
  $("dash-empty").hidden = list.length > 0;
}

function renderCourses() {
  const list = courses();
  $("course-cards").innerHTML = list.map(([c, items]) => courseCardHtml(c, items)).join("");
  $("courses-empty").hidden = list.length > 0;
}

function renderCalendar() {
  const first = state.calMonth;
  $("cal-title").textContent = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const todayKey = dayKey(new Date());
  const byDay = {};
  for (const it of state.items) (byDay[dayKey(it.due)] ||= []).push(it);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  let html = "";
  for (let i = 0; i < cells; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(d);
    const items = (byDay[key] || []).sort((a, b) => new Date(a.due) - new Date(b.due));
    const w = state.weather[key];
    html += `<div class="cal-day ${d.getMonth() !== first.getMonth() ? "other" : ""} ${key === todayKey ? "today" : ""}">
      <div class="cal-num"><span>${d.getDate()}</span>${w ? `<span class="wxs" title="${esc((WEATHER[w.code] || [""])[0])}">${(WEATHER[w.code] || ["", ""])[1]} ${w.max}°</span>` : ""}</div>
      ${items.map((it) => `<button class="cal-ev ${it.done ? "done" : ""}" type="button" data-edit="${esc(it.id)}" style="border-left-color:${(TYPES[it.type] || TYPES.homework).color}" title="${esc(it.title)} — ${esc(shortCourse(it.course))}">${esc(it.title)}</button>`).join("")}
    </div>`;
  }
  $("cal-grid").innerHTML = html;
}

function renderSidebar() {
  const now = new Date();
  const up = state.items.filter((i) => !i.done && new Date(i.due) >= now).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 6);
  $("side-upcoming").innerHTML = up.length
    ? up.map((it) => {
      const t = TYPES[it.type] || TYPES.homework;
      return `<li><span>${t.icon}</span><div><button class="s-title" type="button" data-edit="${esc(it.id)}">${esc(it.title)}</button><div class="muted">${esc(shortCourse(it.course))} · ${fmtDate(it.due, { month: "short", day: "numeric" })}${it.allDay ? "" : " at " + fmtTime(it.due)}</div></div></li>`;
    }).join("")
    : '<li class="muted">Nothing coming up.</li>';

  const overdue = state.items.filter((i) => !i.done && new Date(i.due) < now).length;
  const today = state.items.filter((i) => categorize(i, now) === "today").length;
  const badge = $("nav-badge");
  badge.textContent = overdue + today;
  badge.hidden = !(overdue + today);
}

function renderAll() {
  renderDashboard();
  renderFilters();
  renderTodo();
  renderCalendar();
  renderCourses();
  renderSidebar();
  renderSyncStatus();
  renderDemoBanner();
}

// ---------- Routing ----------

const VIEWS = { dashboard: "Dashboard", todo: "To Do", calendar: "Calendar", courses: "Courses", sync: "Canvas Sync" };
function route() {
  const view = (location.hash.slice(1) || "dashboard").split("?")[0];
  const v = VIEWS[view] ? view : "dashboard";
  for (const key of Object.keys(VIEWS)) $(`view-${key}`).hidden = key !== v;
  document.querySelectorAll(".nav-item[data-view]").forEach((a) => a.classList.toggle("active", a.dataset.view === v));
  $("page-title").textContent = VIEWS[v];
  document.title = `${VIEWS[v]} · Owl Deadlines`;
  window.scrollTo(0, 0);
}

// ---------- Modal ----------

function openModal(id) {
  const it = id ? state.items.find((i) => i.id === id) : null;
  state.editingId = it ? it.id : null;
  $("modal-title").textContent = it ? "Edit deadline" : "Add deadline";
  $("i-title").value = it?.title || "";
  $("i-course").value = it?.course || state.filters.course || "";
  $("i-type").value = it?.type || "homework";
  const due = it ? new Date(it.due) : new Date(+startOfDay(new Date()) + DAY);
  $("i-date").value = dayKey(due);
  $("i-time").value = it ? `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}` : "23:59";
  $("i-url").value = it?.url || "";
  $("i-notes").value = it?.notes || "";
  $("i-delete").hidden = !it;
  const fromCanvas = it?.source === "canvas";
  for (const f of ["i-title", "i-course", "i-date", "i-time", "i-url"]) $(f).readOnly = fromCanvas;
  $("i-canvas-note").hidden = !fromCanvas;
  $("modal").showModal();
  $("i-title").focus();
}

function saveModal(e) {
  e.preventDefault();
  const [y, mo, d] = $("i-date").value.split("-").map(Number);
  const [hh, mi] = ($("i-time").value || "23:59").split(":").map(Number);
  const data = {
    title: $("i-title").value.trim(),
    course: $("i-course").value.trim(),
    type: $("i-type").value,
    due: new Date(y, mo - 1, d, hh, mi).toISOString(),
    allDay: false,
    url: safeUrl($("i-url").value.trim()),
    notes: $("i-notes").value,
  };
  if (!data.title || !y) return;
  const existing = state.items.find((i) => i.id === state.editingId);
  if (existing) {
    if (existing.source === "canvas") {
      // Keep Canvas data authoritative for title/date; remember the user's type & notes
      if (data.type !== existing.type) existing.typeEdited = true;
      if (data.notes !== existing.notes) existing.notesEdited = true;
      existing.type = data.type;
      existing.notes = data.notes;
    } else Object.assign(existing, data);
  } else {
    state.items.push({ id: uid(), source: "manual", done: false, ...data });
  }
  persistItems();
  $("modal").close();
  renderAll();
  toast(existing ? "Deadline updated." : "Deadline added.");
}

// ---------- Events ----------

function bind() {
  window.addEventListener("hashchange", route);
  $("add-btn").addEventListener("click", () => openModal());
  $("sync-btn").addEventListener("click", () => syncCanvas());
  $("item-form").addEventListener("submit", saveModal);
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $("modal").close()));
  $("i-delete").addEventListener("click", () => {
    const it = state.items.find((i) => i.id === state.editingId);
    if (!it) return;
    const note = it.source === "canvas" ? " It will come back on the next Canvas sync unless removed in Canvas." : "";
    if (!confirm(`Delete "${it.title}"?${note}`)) return;
    state.items = state.items.filter((i) => i.id !== it.id);
    persistItems();
    $("modal").close();
    renderAll();
  });

  // Delegated clicks (checkboxes, edit buttons, course cards, stats)
  document.body.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) { openModal(edit.dataset.edit); return; }
    const card = e.target.closest("[data-course]");
    if (card) {
      state.filters.course = card.dataset.course;
      state.filters.range = "";
      $("f-range").value = "";
      location.hash = "#todo";
      renderFilters(); renderTodo();
      return;
    }
    const chip = e.target.closest("[data-type]");
    if (chip) {
      const t = chip.dataset.type;
      state.filters.types.has(t) ? state.filters.types.delete(t) : state.filters.types.add(t);
      renderFilters(); renderTodo();
      return;
    }
    const jump = e.target.closest("[data-jump]");
    if (jump) {
      const j = jump.dataset.jump;
      Object.assign(state.filters, { course: "", search: "", range: "", types: new Set() });
      $("f-search").value = "";
      if (j === "exam") state.filters.types.add("exam");
      else state.filters.range = j;
      $("f-range").value = state.filters.range;
      location.hash = "#todo";
      renderFilters(); renderTodo();
    }
  });
  document.body.addEventListener("change", (e) => {
    const id = e.target.dataset?.toggle;
    if (!id) return;
    const it = state.items.find((i) => i.id === id);
    if (!it) return;
    it.done = e.target.checked;
    persistItems();
    renderAll();
    if (it.done) toast(`Nice work! "${it.title}" marked complete ✓`);
  });

  // Filters
  $("f-search").addEventListener("input", (e) => { state.filters.search = e.target.value; renderTodo(); });
  $("f-course").addEventListener("change", (e) => { state.filters.course = e.target.value; renderTodo(); });
  $("f-range").addEventListener("change", (e) => { state.filters.range = e.target.value; renderTodo(); });
  $("f-done").addEventListener("change", (e) => { state.filters.showDone = e.target.checked; renderTodo(); });

  // Calendar nav
  $("cal-prev").addEventListener("click", () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1); renderCalendar(); });
  $("cal-next").addEventListener("click", () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1); renderCalendar(); });
  $("cal-today").addEventListener("click", () => { state.calMonth = startOfMonth(new Date()); renderCalendar(); });

  // Sync & settings
  $("feed-url").value = state.prefs.feedUrl;
  $("feed-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const url = $("feed-url").value.trim();
    if (!/^https:\/\/.+\.ics(\?.*)?$/i.test(url)) { toast("That doesn't look like a Canvas .ics feed link."); return; }
    state.prefs.feedUrl = url;
    persistPrefs();
    $("sync-status").textContent = "";
    syncCanvas();
  });
  $("ics-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (!text.includes("BEGIN:VCALENDAR")) { toast("That file is not an .ics calendar."); return; }
    const { total, added } = mergeCanvas(parseIcs(text));
    state.prefs.lastSync = Date.now();
    persistPrefs();
    renderAll();
    toast(`Imported ${total} deadlines (${added} new).`);
    e.target.value = "";
  });

  $("pref-name").value = state.prefs.name;
  $("pref-name").addEventListener("input", (e) => { state.prefs.name = e.target.value; persistPrefs(); renderDashboard(); });
  $("pref-campus").innerHTML = Object.entries(CAMPUSES).map(([k, c]) => `<option value="${k}">FAU ${c.name}${k === DEFAULT_CAMPUS ? " (main campus)" : ""}</option>`).join("");
  $("pref-campus").value = state.prefs.campus;
  $("pref-campus").addEventListener("change", (e) => { state.prefs.campus = e.target.value; persistPrefs(); loadWeather(); });
  $("pref-events").checked = state.prefs.includeEvents;
  $("pref-events").addEventListener("change", (e) => {
    state.prefs.includeEvents = e.target.checked;
    persistPrefs();
    toast("Saved. Applies on the next sync.");
  });

  $("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ items: state.items, prefs: { ...state.prefs, feedUrl: "" } }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `owl-deadlines-${dayKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $("restore-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.items)) throw new Error();
      state.items = data.items.filter((i) => i && i.id && i.title && i.due);
      persistItems();
      renderAll();
      toast(`Restored ${state.items.length} deadlines.`);
    } catch { toast("Could not read that backup file."); }
    e.target.value = "";
  });
  $("demo-btn").addEventListener("click", () => loadDemo());
  $("banner-remove").addEventListener("click", () => $("clear-demo-btn").click());
  $("clear-demo-btn").addEventListener("click", () => {
    state.items = state.items.filter((i) => i.source !== "demo");
    persistItems();
    renderAll();
    toast("Sample deadlines removed.");
  });
  $("clear-canvas-btn").addEventListener("click", () => {
    if (!confirm("Remove all items imported from Canvas? Your manual deadlines stay.")) return;
    state.items = state.items.filter((i) => i.source !== "canvas");
    persistItems();
    renderAll();
  });
  $("reset-btn").addEventListener("click", () => {
    if (!confirm("Delete ALL deadlines and settings stored in this browser?")) return;
    try { localStorage.removeItem("od-items"); localStorage.removeItem("od-prefs"); } catch { /* ignore */ }
    location.reload();
  });

  $("i-type").innerHTML = Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join("");

  // Keep countdowns fresh
  setInterval(() => { renderTodo(); renderSidebar(); renderDashboard(); }, 60000);
}

// ---------- Sample data (preview what the planner looks like) ----------

// Imaginary MSBA semester at FAU — dates are relative to today so the demo always looks current.
const DEMO_COURSES = {
  AI: "ISM6247-001 Business Innovation with AI",
  DM: "ISM6136-002 Data Mining",
  ST: "QMB6603-001 Business Analytics Statistics",
  DB: "ISM6218-001 Database Management",
  VZ: "ISM6419-001 Data Visualization",
};
const DEMO_ITEMS = [
  // [title, course, type, daysFromToday, hour, minute, done, notes]
  ["Module 8 Reading Reflection", "AI", "homework", -4, 23, 59, true, "Reflection on AI adoption at small businesses."],
  ["SQL Lab 5: Joins & Subqueries", "DB", "homework", -3, 23, 59, true, "Submit the .sql file and screenshots."],
  ["Quiz 4: Regression Basics", "ST", "quiz", -2, 21, 0, true, "20 questions, 40 minutes, Respondus LockDown."],
  ["Discussion 5: AI in Retail", "DM", "homework", -1, 23, 59, false, "Initial post + reply to 2 classmates."],
  ["Dashboard Critique Memo", "VZ", "homework", -1, 18, 0, false, "1-page memo critiquing a public Tableau dashboard."],
  ["Homework 4: AI Use Cases", "AI", "homework", 0, 23, 59, false, "Identify 3 AI use cases for a local business."],
  ["Quiz 3: Generative AI", "AI", "quiz", 0, 20, 0, false, "Covers chapters 6–7. Open book."],
  ["Problem Set 6: Hypothesis Testing", "ST", "homework", 1, 23, 59, false, "Use Excel or R. Show all work."],
  ["Tableau Lab 3: Maps & Filters", "VZ", "homework", 2, 23, 59, false, "Publish to Tableau Public and submit the link."],
  ["Quiz 5: Classification Trees", "DM", "quiz", 3, 18, 0, false, "Chapters 9–10."],
  ["ER Diagram Assignment", "DB", "homework", 4, 23, 59, false, "Design the database for a campus bookstore."],
  ["Group Project Proposal", "DM", "project", 5, 23, 59, false, "Team of 4. Dataset, question and method (2 pages)."],
  ["Midterm Exam", "ST", "exam", 7, 17, 0, false, "In person, Boca Raton campus, bring a calculator."],
  ["AI Innovation Pitch Deck", "AI", "project", 9, 12, 0, false, "10-slide pitch for an AI-powered startup idea."],
  ["Database Midterm Exam", "DB", "exam", 11, 19, 0, false, "Online via Canvas. ER diagrams + SQL."],
  ["Homework 5: Prompt Engineering", "AI", "homework", 12, 23, 59, false, ""],
  ["Visualization Storyboard", "VZ", "project", 14, 23, 59, false, "Storyboard for the final dashboard project."],
  ["Quiz 6: ANOVA", "ST", "quiz", 15, 21, 0, false, ""],
  ["Case Study Presentation", "AI", "project", 18, 12, 0, false, "15-minute team presentation in class."],
  ["Data Mining Project Milestone 2", "DM", "project", 21, 23, 59, false, "Cleaned dataset + exploratory analysis."],
  ["Final Database Project", "DB", "project", 28, 23, 59, false, "Working database + documentation + demo video."],
  ["Final Dashboard Project", "VZ", "project", 31, 23, 59, false, "Interactive Tableau dashboard + 5-min video."],
  ["Final Exam", "ST", "exam", 33, 10, 30, false, "Cumulative. In person, Boca Raton campus."],
  ["Final Exam", "DM", "exam", 35, 10, 30, false, "Cumulative. Online via Canvas."],
  ["Final Reflection Paper", "AI", "project", 36, 23, 59, false, "3–5 pages on what you learned about AI and innovation."],
];

function loadDemo({ quiet = false } = {}) {
  const at = (days, h, m) => { const d = startOfDay(new Date()); d.setDate(d.getDate() + days); d.setHours(h, m); return d.toISOString(); };
  state.items = state.items.filter((i) => i.source !== "demo").concat(
    DEMO_ITEMS.map(([title, c, type, days, h, m, done, notes], n) => ({
      id: "demo-" + n, source: "demo", title, course: DEMO_COURSES[c], type, due: at(days, h, m),
      allDay: false, url: "", notes, done,
    }))
  );
  state.prefs.demoSeeded = true;
  persistPrefs();
  persistItems();
  renderAll();
  if (!quiet) toast("Sample deadlines added. They disappear when you sync Canvas.");
}

function renderDemoBanner() {
  $("demo-banner").hidden = !state.items.some((i) => i.source === "demo");
}

// ---------- Start ----------

bind();
route();
if (!state.prefs.feedUrl && (state.items.some((i) => i.source === "demo") || (!state.prefs.demoSeeded && !state.items.length))) {
  loadDemo({ quiet: true });
}
renderAll();
loadWeather();
if (state.prefs.feedUrl && Date.now() - state.prefs.lastSync > AUTO_SYNC_MS) syncCanvas({ silent: true });
