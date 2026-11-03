// Netlify Function: fetches a Canvas calendar feed (.ics) on behalf of the browser.
// Canvas does not send CORS headers, so the page cannot download the feed directly.
// Only Canvas / FAU hosts are allowed so this can't be used as an open proxy.

const ALLOWED_HOSTS = [/\.instructure\.com$/i, /(^|\.)fau\.edu$/i];
const MAX_BYTES = 5 * 1024 * 1024;

export default async (req) => {
  const target = new URL(req.url).searchParams.get("url") || "";
  let url;
  try {
    url = new URL(target);
  } catch {
    return text("Missing or invalid ?url= parameter.", 400);
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.some((re) => re.test(url.hostname))) {
    return text("Only https Canvas feed links (*.instructure.com or *.fau.edu) are allowed.", 400);
  }
  if (!/\/feeds\/calendars\//.test(url.pathname)) {
    return text("That is not a Canvas calendar feed link (expected /feeds/calendars/…).", 400);
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/calendar, */*", "User-Agent": "OwlDeadlines/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return text(`Canvas responded with HTTP ${res.status}. Check the feed link.`, 502);
    const body = await res.text();
    if (body.length > MAX_BYTES) return text("Calendar feed is too large.", 413);
    if (!body.includes("BEGIN:VCALENDAR")) return text("The link did not return a calendar.", 502);
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return text(`Could not reach Canvas: ${err.message}`, 502);
  }
};

function text(message, status) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export const config = { path: "/api/canvas-feed" };
