# ISM6247 – Glass Weather

A glassmorphic weather app built with plain HTML, CSS and JavaScript, powered by the free
[Open-Meteo API](https://open-meteo.com/) (no API key needed).

## Features
- Default location: **Boca Raton, FL**
- Current conditions, feels-like, humidity, wind, UV index, precipitation, sunrise/sunset
- 24-hour hourly strip and 7-day forecast with temperature range bars
- City search with live suggestions (Open-Meteo Geocoding API)
- "Use my location" button and °F / °C toggle (remembered in the browser)
- **Light / Dark / System** theme switch (System follows your device setting automatically)
- Personal greeting ("Good morning, Name! 👋") with a short weather summary; set your name once and it's remembered
- Background colors change with the weather (clear, cloudy, rain, storm, snow, fog, night)
- Responsive on desktop and mobile

## Files
| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `style.css` | Glassmorphism styling |
| `app.js` | API calls and rendering |
| `netlify.toml` | Netlify config (publishes the repo root, no build step) |

## Run locally
Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Deploy to Netlify
Connect this repo in Netlify (or drag and drop the folder). Use the `main` branch;
leave the build command empty and set the publish directory to `.` (already set in `netlify.toml`).
