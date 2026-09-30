import { renderTrip } from "./trip.js";
import { nav } from "./nav.js";
import { renderGuide } from "./guide.js";

// Watch eticket.uzrailpass.uz for free seats and alert on Telegram; serve the trip pages.
// Cron runs every 5 minutes. Alerts only when a train goes from < passengers to >= passengers seats.
// All personal trip data (bookings, hotels, plan, watched trains) lives in the private KV key "trip",
// uploaded from a local trip.json that is not in the repo. See trip.example.json for the format.

const BASE = "https://eticket.uzrailpass.uz";
// Low-seat warnings for available preferred trains: level 1 below 10 seats, level 2 (urgent) below 6.
const LOW_LEVELS = [{ below: 10, level: 1 }, { below: 6, level: 2 }];
// Ticket numbers carry a car-type suffix (752ЖА) that the API number (752Ж) does not.
const isBooked = (trip, date, number) => trip.bookings.some((b) => b.date === date && b.train.startsWith(number));
const lowLevel = (n) => LOW_LEVELS.reduce((lv, t) => (n < t.below ? t.level : lv), 0);
// A train must look sold out on this many runs in a row (15 min) before it can alert again. The API
// sometimes briefly drops a train or reports empty cars, which used to cause duplicate alerts.
const SOLD_OUT_RUNS = 3;
const ERROR_ALERT_AFTER = 6; // consecutive failed runs (30 min) before an error push

// Railway station codes used by the search API.
const STATIONS = { Tashkent: "2900000", Samarkand: "2900700", Bukhara: "2900800", Khiva: "2900172" };
const NAMES = Object.fromEntries(Object.entries(STATIONS).map(([name, code]) => [code, name]));

// HS = Afrosiyob. В-СКОР = Jaloliddin Manguberdi, the only fast train to/from Khiva.
const FAST = ["HS", "В-СКОР"];

// Trip data from KV. A watch entry: { date, from: "Khiva", to: "Tashkent", after?, before?, fastOnly?, priority?, why }.
// Departure window is [after, before). priority: an alternative preferred over what is booked; alerts are marked ⭐.
const EMPTY_TRIP = { start: null, end: null, startCity: "Tashkent", passengers: 2, bookings: [], hotels: [], events: [],
  planned: [], watch: [], plan: {}, slips: [] };
async function loadTrip(env) {
  const t = { ...EMPTY_TRIP, ...((await env.STATE.get("trip", "json")) ?? {}) };
  t.legs = t.watch.map((w) => ({ date: w.date, from: STATIONS[w.from], to: STATIONS[w.to], after: w.after ?? "00:00",
    before: w.before ?? "24:00", types: w.fastOnly ? FAST : null, priority: !!w.priority, why: w.why ?? "" }));
  return t;
}

async function openSession() {
  const res = await fetch(BASE + "/api/v1/csrf-token");
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  const token = cookies.find((c) => c.startsWith("XSRF-TOKEN="))?.split("=")[1];
  if (!token) throw new Error(`no XSRF-TOKEN (HTTP ${res.status})`);
  return { token, cookie: cookies.join("; ") };
}

async function fetchTrains({ token, cookie }, date, dep, arv) {
  const body = JSON.stringify({
    directions: { forward: { date, depStationCode: dep, arvStationCode: arv } },
    routeType: "INTERCITY",
  });
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(BASE + "/api/v3/handbook/trains/list", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json", "Accept-Language": "en", "X-XSRF-TOKEN": token, Cookie: cookie },
      });
      const data = await res.json();
      if (data.error || data.data == null) throw new Error(`API error ${date} ${dep}->${arv}: ${JSON.stringify(data)}`);
      // An empty "directions" object means no trains run that day.
      return data.data.directions.forward?.trains ?? [];
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

// Alerts go to Telegram (TELEGRAM_TOKEN secret). Every private chat that messages the bot receives
// alerts; chat IDs are collected from getUpdates on each run (Telegram keeps updates for only 24 h)
// and kept in state.
const MAX_CHATS = 5; // the bot is unlisted, but cap who can subscribe
async function refreshChats(env, state) {
  state.telegramChats ??= state.telegramChatId ? [state.telegramChatId] : [];
  if (!env.TELEGRAM_TOKEN || env.DRY_RUN) return;
  const data = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getUpdates`)).json();
  for (const u of data.result ?? []) {
    const chat = u.message?.chat;
    if (chat?.type === "private" && !state.telegramChats.includes(chat.id) && state.telegramChats.length < MAX_CHATS) {
      state.telegramChats.push(chat.id);
    }
  }
}

async function notify(env, state, title, message) {
  if (env.DRY_RUN) return console.log("DRY_RUN notify:", title, message); // local testing only
  if (!env.TELEGRAM_TOKEN) throw new Error("TELEGRAM_TOKEN secret is not set");
  if (!state.telegramChats?.length) throw new Error("Telegram: send any message to the bot first so it learns your chat");
  const results = await Promise.all(state.telegramChats.map((chatId) =>
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `${title}\n\n${message}\n\n${BASE}/en/home`, disable_web_page_preview: true }),
    })));
  // Delivered if at least one chat got it; a blocked bot in one chat must not cause endless re-alerts.
  if (!results.some((r) => r.ok)) throw new Error(`Telegram HTTP ${results.map((r) => r.status).join(",")}`);
}

// Daily forecast per city from Open-Meteo (free, no key, 16 days ahead). Refreshed every 30 minutes
// inside the cron run and kept in state, so the pages never wait for it.
const WEATHER_EVERY_MS = 30 * 60 * 1000;
const WEATHER_CITIES = { Tashkent: [41.31, 69.28], Samarkand: [39.65, 66.97], Bukhara: [39.77, 64.42], Khiva: [41.38, 60.36] };
async function refreshWeather(state, trip) {
  if (!trip.start) return;
  if (state.weather && Date.now() - new Date(state.weather.at) < WEATHER_EVERY_MS) return;
  const names = Object.keys(WEATHER_CITIES);
  const q = new URLSearchParams({
    latitude: names.map((n) => WEATHER_CITIES[n][0]).join(","), longitude: names.map((n) => WEATHER_CITIES[n][1]).join(","),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset",
    timezone: "Asia/Tashkent", start_date: trip.start, end_date: trip.end,
  });
  const data = await (await fetch(`https://api.open-meteo.com/v1/forecast?${q}`)).json();
  const days = {};
  names.forEach((name, i) => {
    const d = data[i].daily;
    d.time.forEach((date, j) => {
      if (d.temperature_2m_max[j] == null) return; // beyond the forecast range
      (days[name] ??= {})[date] = { code: d.weather_code[j], max: Math.round(d.temperature_2m_max[j]),
        min: Math.round(d.temperature_2m_min[j]), rain: d.precipitation_probability_max[j], sunset: d.sunset[j]?.slice(11) };
    });
  });
  state.weather = { at: new Date().toISOString(), days };
}

// All state is one KV key, written once per run: the KV free tier allows 1,000 writes a day.
async function loadState(env) {
  const s = (await env.STATE.get("state", "json")) ?? {};
  return { seats: {}, trains: {}, notified: {}, last: null, errors: 0, ...s };
}

async function check(env, state, trip) {
  const LEGS = trip.legs, PASSENGERS = trip.passengers;
  const session = await openSession();
  const seats = {}, trains = {}, notified = {}, low = {}, found = [], lowAlerts = [], warnings = [];
  const oldLow = state.low ?? {}, oldSoldOut = state.soldOut ?? {};
  const soldOut = {}; // key -> consecutive runs below PASSENGERS, only for trains already alerted

  for (const leg of LEGS) {
    let list;
    try {
      list = await fetchTrains(session, leg.date, leg.from, leg.to);
    } catch (e) {
      // Keep the old state for this leg so a failed call does not cause a re-notify.
      warnings.push(String(e));
      for (const [k, v] of Object.entries(state.seats)) if (k.startsWith(leg.date)) seats[k] = v;
      for (const [k, v] of Object.entries(state.trains)) if (k.startsWith(leg.date)) trains[k] = v;
      for (const k of Object.keys(state.notified)) if (k.startsWith(leg.date)) notified[k] = true;
      for (const [k, v] of Object.entries(oldLow)) if (k.startsWith(leg.date)) low[k] = v;
      for (const [k, v] of Object.entries(oldSoldOut)) if (k.startsWith(leg.date)) soldOut[k] = v;
      continue;
    }
    // An alerted train missing from the response is treated like one sold-out run, not as gone.
    const seen = new Set(list.map((t) => `${leg.date} ${t.number}`));
    for (const k of Object.keys(state.notified)) {
      if (!k.startsWith(leg.date + " ") || seen.has(k) || state.trains[k]?.from !== leg.from) continue;
      const runs = (oldSoldOut[k] ?? 0) + 1;
      if (runs < SOLD_OUT_RUNS) {
        notified[k] = true; soldOut[k] = runs; seats[k] = state.seats[k]; trains[k] = state.trains[k];
        if (oldLow[k]) low[k] = oldLow[k];
      }
    }
    for (const t of list) {
      const depTime = t.departureDate.slice(-5);
      // Every train is stored for the /trip page; only preferred ones (type and time window match) alert.
      const preferred = (!leg.types || leg.types.includes(t.type)) && depTime >= leg.after && depTime < leg.before;
      const n = t.cars.reduce((sum, c) => sum + (c.freeSeats || 0), 0);
      const key = `${leg.date} ${t.number}`;
      seats[key] = n;
      trains[key] = { brand: t.brand, type: t.type, from: leg.from, to: leg.to, dep: depTime, preferred,
        arr: t.arrivalDate.slice(-5), arrDate: t.arrivalDate.slice(0, 10), duration: t.timeOnWay };
      if (!preferred) continue;
      // notified: trains already alerted while they had seats. Cleared when they sell out again.
      if (n >= PASSENGERS && state.notified[key]) notified[key] = true;
      if (n < PASSENGERS && state.notified[key]) {
        const runs = (oldSoldOut[key] ?? 0) + 1;
        if (runs < SOLD_OUT_RUNS) { notified[key] = true; soldOut[key] = runs; if (oldLow[key]) low[key] = oldLow[key]; }
      }
      const label = `${leg.date.slice(8)}.${leg.date.slice(5, 7)} ${NAMES[leg.from]}→${NAMES[leg.to]} ${t.brand} ${t.number} ` +
        `${depTime}→${t.arrivalDate.slice(-5)}`;
      // Booked trains never send low-seat warnings.
      // low: the warning level already sent for this train. It drops back when seats go up, so a new
      // decline warns again; it is removed when the train falls below PASSENGERS seats.
      if (n >= PASSENGERS && state.notified[key]) {
        const level = lowLevel(n), prev = oldLow[key] ?? 0;
        low[key] = Math.min(level, prev);
        if (level > prev && !isBooked(trip, leg.date, t.number)) lowAlerts.push({ key, level, text: `${level === 2 ? "🚨" : "⚠️"} ${label} — only ${n} seats left` });
      }
      if (n >= PASSENGERS && !state.notified[key]) {
        // Per-tariff seat counts can be 0 while the car has seats, so report per car with the lowest price.
        const classes = t.cars.filter((c) => c.freeSeats).map((c) => {
          const min = Math.min(...(c.tariffs ?? []).map((x) => x.tariff));
          return `${c.type}: ${c.freeSeats}${isFinite(min) ? ` from ${min.toLocaleString("en")} UZS` : ""}`;
        }).join(", ");
        // The availability alert already shows the seat count, so it also sets the warning level.
        found.push({ key, level: lowLevel(n), priority: leg.priority,
          text: `${leg.priority ? "⭐ " : ""}${label} (${t.timeOnWay}) — ${n} seats (${classes})` });
      }
    }
  }

  if (found.length) {
    found.sort((a, b) => b.priority - a.priority);
    const title = found.some((f) => f.priority) ? "⭐ Preferred train has free seats" : `🚄 ${found.length} train(s) with free seats`;
    try {
      await notify(env, state, title, found.map((f) => f.text).join("\n"));
      for (const f of found) { notified[f.key] = true; low[f.key] = f.level; }
    } catch (e) {
      // Not delivered: leave them out of "notified" so the next run alerts again.
      warnings.push(String(e));
    }
  }
  if (lowAlerts.length) {
    const urgent = lowAlerts.some((a) => a.level === 2);
    const title = urgent ? "🚨 URGENT: preferred train almost sold out" : "⚠️ Preferred train running low";
    lowAlerts.sort((a, b) => b.level - a.level);
    try {
      await notify(env, state, title, lowAlerts.map((a) => a.text).join("\n") + "\n\nBook now if you want it.");
      for (const a of lowAlerts) low[a.key] = a.level;
    } catch (e) {
      warnings.push(String(e)); // not delivered: the level stays lower, so the next run warns again
    }
  }
  if (LEGS.length && warnings.length > LEGS.length - 1) throw Object.assign(new Error(warnings.join(" | ")), { seats, trains, notified, low, soldOut });
  const pref = Object.keys(seats).filter((k) => trains[k]?.preferred);
  const avail = pref.filter((k) => seats[k] >= PASSENGERS).length;
  return { seats, trains, notified, low, soldOut, warnings,
    summary: `checked ${Object.keys(seats).length} trains (${pref.length} preferred), ${avail} preferred with ${PASSENGERS}+ seats, ${found.length} new, ${lowAlerts.length} low-seat warnings` };
}

// Offline copy of /trip and /guide: network first, cached copy when there is no signal (trains, desert).
const SERVICE_WORKER = `
const CACHE = "uz-trip-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/trip", "/guide"]))); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const ours = ["/trip", "/guide"].includes(url.pathname) || url.pathname.startsWith("/files/");
  if (e.request.method !== "GET" || url.origin !== location.origin || !ours) return;
  e.respondWith(fetch(e.request).then((res) => {
    // A redirect means the Access session expired (login page): never cache that over the real page.
    if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copy)); }
    return res;
  }).catch(() => caches.match(url.pathname)));
});`;

// Cloudflare Access puts a signed JWT in the Cf-Access-Jwt-Assertion header. Verify it against the team's
// public keys (RS256) and the application audience, so the Worker is closed even if Access is misconfigured.
// ACCESS_TEAM ("<team>.cloudflareaccess.com") and ACCESS_AUD are Worker variables; without them nothing is served.
let accessKeys = null;
async function checkAccess(request, env) {
  if (env.DRY_RUN) return null; // local testing only
  const deny = (why) => new Response(`Access denied: ${why}`, { status: 403 });
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return deny("Cloudflare Access is not configured");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return deny("sign in through Cloudflare Access");
  try {
    const [h, p, sig] = token.split(".");
    const dec = (x) => JSON.parse(atob(x.replace(/-/g, "+").replace(/_/g, "/")));
    const header = dec(h), payload = dec(p);
    if (!accessKeys) accessKeys = (await (await fetch(`https://${env.ACCESS_TEAM}/cdn-cgi/access/certs`)).json()).keys;
    const jwk = accessKeys.find((k) => k.kid === header.kid);
    if (!jwk) { accessKeys = null; return deny("unknown signing key"); }
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const bytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytes, new TextEncoder().encode(`${h}.${p}`));
    const aud = [].concat(payload.aud);
    if (!ok || !aud.includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()) return deny("invalid token");
    return null;
  } catch {
    return deny("invalid token");
  }
}

export default {
  async scheduled(event, env, ctx) {
    const [state, trip] = await Promise.all([loadState(env), loadTrip(env)]);
    const at = new Date().toISOString();
    await refreshChats(env, state).catch((e) => console.error("refreshChats", e));
    await refreshWeather(state, trip).catch((e) => console.error("refreshWeather", e));
    try {
      const r = await check(env, state, trip);
      console.log(r.summary, r.warnings);
      const ok = !r.warnings.length;
      await env.STATE.put("state", JSON.stringify({ seats: r.seats, trains: r.trains, notified: r.notified, low: r.low, soldOut: r.soldOut, telegramChats: state.telegramChats, weather: state.weather, errors: ok ? 0 : state.errors + 1,
        last: { at, ok, summary: r.summary, error: ok ? undefined : r.warnings.join(" | ") } }));
      if (!ok && state.errors + 1 === ERROR_ALERT_AFTER) await notify(env, state, "⚠️ Train watcher failing", r.warnings[0]).catch(() => {});
    } catch (e) {
      console.error(e);
      const errors = state.errors + 1;
      await env.STATE.put("state", JSON.stringify({ seats: e.seats ?? state.seats, trains: e.trains ?? state.trains, notified: e.notified ?? state.notified, low: e.low ?? state.low, soldOut: e.soldOut ?? state.soldOut, telegramChats: state.telegramChats, weather: state.weather,
        errors, last: { at, ok: false, error: String(e) } }));
      if (errors === ERROR_ALERT_AFTER) await notify(env, state, "⚠️ Train watcher failing", String(e)).catch(() => {});
    }
  },

  // Pages: /trip (plan), /guide (reference), /files/<name> (tickets, bookings), /status (JSON). "/" opens /trip.
  // Everything sits behind Cloudflare Access; requests without a valid Access token get 403.
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    const denied = await checkAccess(request, env);
    if (denied) return denied;
    const html = (body) => new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    if (path === "/") return Response.redirect(new URL("/trip", request.url), 302);
    if (path === "/sw.js") return new Response(SERVICE_WORKER, { headers: { "Content-Type": "text/javascript", "Cache-Control": "no-store" } });
    if (path.startsWith("/files/")) {
      // Files are stored in KV as "file:<name>" with their content type in the metadata.
      const name = decodeURIComponent(path.slice(7));
      const { value, metadata } = await env.STATE.getWithMetadata(`file:${name}`, "arrayBuffer");
      if (!value) return new Response("Not found", { status: 404 });
      return new Response(value, { headers: { "Content-Type": metadata?.type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${name.split("/").pop()}"`, "Cache-Control": "private, max-age=86400" } });
    }
    const trip = await loadTrip(env);
    if (path === "/guide") return html(renderGuide(nav("guide"), trip));
    const { seats, trains, last, weather } = await loadState(env);
    if (path === "/trip") {
      return html(renderTrip({ bookings: trip.bookings, hotels: trip.hotels, events: trip.events, legs: trip.legs, names: NAMES,
        seats, trains, last, passengers: trip.passengers, tripStart: trip.start, tripEnd: trip.end, startCity: trip.startCity,
        planned: trip.planned, plan: trip.plan, nav: nav("trip"), weather: weather?.days ?? {} }));
    }
    if (path !== "/status") return new Response("Not found", { status: 404 });
    // Train numbers end in Cyrillic letters (772Ф), so declare UTF-8 or browsers show Ð¤.
    return new Response(JSON.stringify({ last, seats }, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  },
};
