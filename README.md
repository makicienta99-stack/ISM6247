# ISM6247 – Kamahe Allegro shop + Owl Deadlines

## Kamahe Allegro (main page `/`)
Online shop for **Kamahe Allegro** ([@kamaheallegro](https://www.instagram.com/kamaheallegro/)), a Peruvian brand of
colorful clothing for young people made with **100% Peruvian cotton**. The design uses the Instagram gradient colors
(yellow #feda75, orange #fa7e1e, pink #d62976, purple #962fbf, blue #4f5bd5) with Grand Hotel + Montserrat typography (Google Fonts).

- Shop grid with filters (Tops, Hoodies, Bottoms, Sets) and Instagram-style story highlights
- Product view with color and size, shopping bag saved in the browser
- **Order by Instagram DM**: copies the order and opens the chat with @kamaheallegro (no payment processor needed yet)
- **Outfit of the day**: weather from the free [Open-Meteo API](https://open-meteo.com/) for Boca Raton, Miami, Orlando, New York, Lima, Cusco or Arequipa, with clothing picks for the temperature
- Light/dark mode, works on phones
- Edit products and prices in `shop.js` (`PRODUCTS`). Add real photos in `images/products/` (see the README there)

| File | Purpose |
|------|---------|
| `index.html` | Shop page |
| `shop.css` | Instagram-style theme |
| `shop.js` | Catalog, bag, Instagram DM order, Open-Meteo outfit picks |
| `images/logo.svg` | Logo (replace with your real logo if you want) |

## Owl Deadlines (FAU Canvas planner, now at `/planner/`)

A deadline organizer for **Florida Atlantic University** students. It pulls homework, projects,
quizzes and exams from your FAU Canvas calendar and shows them in a Canvas-style layout in FAU
blue (#003366) and red (#CC0000). Weather for your campus comes from the free
[Open-Meteo API](https://open-meteo.com/) (no API key needed). The default campus is **FAU Boca Raton**.

## Features
- **Canvas Sync**: paste your Canvas *Calendar Feed* link and the app imports every assignment.
  It re-syncs automatically (at most once an hour) when you open the app. You can also upload the `.ics` file instead.
- Sorts deadlines automatically into **Homework, Project, Quiz, Exam** (and optional calendar Events), based on the title. You can change the type yourself.
- **Dashboard**: overdue / due today / next 7 days / upcoming exams counters, plus Canvas-style course cards
- **To Do** list grouped by Overdue, Today, Tomorrow, This week, Later, with live countdowns,
  search, and filters by course, type and time. Check items off as you finish them.
- **Calendar** month view with color-coded deadlines and the weather forecast on each day
- **Weather** for FAU Boca Raton (or Jupiter, Davie, Fort Lauderdale, Harbor Branch): current conditions,
  a 5-day strip, and the forecast next to each deadline in the next 16 days (with rain chance so you know when to leave early for an exam)
- Add your own deadlines by hand (group meetings, personal tasks, etc.)
- Export or restore a backup; all data stays in your browser (localStorage)
- Works on phones (the menu moves to a bottom bar)
- The previous weather app is still available at `/weather/`

## How to get your FAU Canvas feed link
1. Log in to Canvas (canvas.fau.edu) and click **Calendar** in the left menu.
2. At the bottom of the right sidebar, click **Calendar Feed** and copy the link.
3. In Owl Deadlines, open **Canvas Sync**, paste the link, and click **Save & Sync**.

> Keep this link private. Anyone who has it can see your Canvas calendar.

## Files
| File | Purpose |
|------|---------|
| `planner/index.html` | Planner page structure |
| `planner/planner.css` | Canvas-style FAU theme |
| `planner/planner.js` | Canvas feed parsing, deadlines, calendar, Open-Meteo weather |
| `netlify/functions/canvas-feed.mjs` | Small server function that downloads the Canvas feed (Canvas blocks browsers from fetching it directly). It only accepts `*.instructure.com` / `*.fau.edu` calendar feed links. |
| `netlify.toml` | Netlify config (publishes the repo root, no build step, functions folder) |
| `weather/` | The earlier Glass Weather app |

## Deploy to Netlify (manual)
Use **Add new site → Import an existing project** and pick this GitHub repo with the `main` branch.
Leave the build command empty. The publish directory (`.`) and functions folder are already set in `netlify.toml`.

> Use the Git import instead of drag-and-drop. Drag-and-drop deploys don't include the Netlify function, so
> **Canvas Sync** by link won't work that way (uploading the `.ics` file still works).

## Run locally
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000 (shop) or http://localhost:8000/planner/ (planner). To test link sync locally, run `netlify dev` (Netlify CLI) instead.

*Made by a student for FAU Owls. Not affiliated with Florida Atlantic University or Instructure Canvas.*
