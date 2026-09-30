// Renders /trip: a calendar overview plus a day-by-day agenda with booked tickets and live seat status.

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const fmt = (n) => Math.round(n).toLocaleString("en");
// "≈ 391 PLN · ≈ 1,200,000 UZS", from an amount in any currency (the original currency is not shown). rates are units per 1 PLN.
function money(amount, currency, rates) {
  if (amount == null) return "";
  if (!rates?.[currency]) return `${fmt(amount)} ${currency}`;
  const pln = amount / rates[currency], uzsAmount = pln * rates.UZS;
  const parts = [];
  if (currency !== "PLN") parts.push(`≈ ${fmt(pln)} PLN`); else parts.push(`${fmt(amount)} PLN`);
  if (currency === "UZS") parts.unshift(`${fmt(amount)} UZS`); else parts.push(`≈ ${fmt(Math.round(uzsAmount / 1000) * 1000)} UZS`);
  return parts.join(" · ");
}
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const fmtDur = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
// "02:13" from the API, or computed from dep/arr for bookings (arrival may be the next day).
const durOf = (t) => t.duration ? fmtDur(toMin(t.duration)) : fmtDur((toMin(t.arr) - toMin(t.dep) + 1440) % 1440);
const FAST_TYPES = new Set(["HS", "В-СКОР"]);
const dayLabel = (d, opts) => d.toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

// WMO weather codes used by Open-Meteo.
const WX = (c) => c === 0 ? ["☀️", "Clear"] : c <= 2 ? ["🌤️", "Mostly sunny"] : c === 3 ? ["☁️", "Cloudy"] : c <= 48 ? ["🌫️", "Fog"]
  : c <= 57 ? ["🌦️", "Drizzle"] : c <= 67 ? ["🌧️", "Rain"] : c <= 77 ? ["🌨️", "Snow"] : c <= 82 ? ["🌦️", "Showers"] : ["⛈️", "Storm"];
// yr.no (Norwegian Meteorological Institute) takes coordinates in the URL: a full forecast for the city.
const YR = { Tashkent: "41.311,69.280", Samarkand: "39.655,66.975", Bukhara: "39.775,64.420", Khiva: "41.378,60.360" };
const yrLink = (city) => `https://www.yr.no/en/forecast/daily-table/${YR[city] ?? YR.Tashkent}`;
function wxHtml(w, cls = "wx", city = "Tashkent", date = "") {
  if (!w) return "";
  const [icon, label] = WX(w.code);
  // The script at the end of the page points the link at that day's hour-by-hour table when yr.no covers it.
  return `<a class="${cls}" href="${yrLink(city)}" data-yr="${YR[city] ?? YR.Tashkent}" data-date="${date}" target="_blank" rel="noopener" title="${label} · full forecast on yr.no">${icon} ${w.max}° / ${w.min}°${w.rain ? ` · 💧${w.rain}%` : ""}${w.sunset ? ` · 🌇 ${w.sunset}` : ""} ↗</a>`;
}
const fileLinks = (files = [], label = "") => files.length
  ? `<div class="files">${files.map((f) => `<a class="file" href="/files/${encodeURIComponent(f)}" target="_blank">${label || `📎 ${esc(f.split("/").pop())}`}</a>`).join("")}</div>` : "";
function hotelCard(h, rates) {
  const meta = [
    h.checkInTime && `<span class="pill">Check-in ${esc(h.checkInTime)}</span>`,
    h.checkOut && `<span class="pill">Check-out ${esc(h.checkOut.slice(8))}.${esc(h.checkOut.slice(5, 7))}${h.checkOutTime ? ` ${esc(h.checkOutTime)}` : ""}</span>`,
    h.paid != null && `<span class="pill">${h.paid ? "✅ Paid" : "💳 Pay at the hotel"}</span>`,
    h.price && `<span class="pill">💰 ${esc(typeof h.price === "object" ? money(h.price.amount, h.price.currency, rates) : h.price)}</span>`,
    h.phone && `<a class="pill" href="tel:${esc(h.phone.replace(/\s/g, ""))}">📞 ${esc(h.phone)}</a>`,
  ].filter(Boolean).join("");
  const maps = h.address ? `<a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ", " + h.address)}" target="_blank" rel="noopener">📍 ${esc(h.address)}</a>` : "";
  return `<div class="card hotel-card"><div class="card-head"><span class="badge ok">🏨 Hotel</span></div>
    <div class="route">${esc(h.name)}</div>${maps}
    ${h.nameLocal || h.addressLocal ? `<div class="ru" title="Show this to the taxi driver">🇷🇺 <b>${esc(h.nameLocal ?? "")}</b><br>${esc(h.addressLocal ?? "")}</div>` : ""}
    <div class="pills">${meta}</div>${h.notes ? `<div class="note">${esc(h.notes)}</div>` : ""}${fileLinks(h.files)}</div>`;
}
const TAG_ICON = { sight: "🏛️", food: "🍽️", move: "🚆", tip: "💡" };
function slotHtml(x, cls = "") {
  const chips = [x.cost && `<span class="chip-cost">${esc(x.cost)}</span>`, x.book && '<span class="chip-book">Book ahead</span>'].filter(Boolean).join("");
  return `<div class="slot ${cls}"><div class="st">${esc(x.time || "")}</div><div class="sdot">${TAG_ICON[x.tag] ?? "•"}</div>
    <div class="sb"><b>${esc(x.title)}</b>${chips ? `<div class="schips">${chips}</div>` : ""}${x.note ? `<p>${esc(x.note)}</p>` : ""}</div></div>`;
}
// Empty times keep their place after the previous slot.
function withSortKeys(items) {
  let prev = "00:00";
  return items.map((x) => ({ ...x, key: x.time ? (prev = x.time) : prev }));
}

function journey({ dep, arr, from, to, duration, nextDay }) {
  return `
  <div class="journey">
    <div class="end"><div class="time">${esc(dep)}</div><div class="station">${esc(from)}</div></div>
    <div class="line"><span class="dur">${esc(duration)}</span></div>
    <div class="end right"><div class="time">${esc(arr)}${nextDay ? '<sup>+1</sup>' : ""}</div><div class="station">${esc(to)}</div></div>
  </div>`;
}

// City for each day: "A → B" on a day a train leaves (booked or planned), otherwise the city of the last arrival.
function citiesByDate(bookings, startCity, start, end) {
  const out = {};
  let city = startCity;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const date = iso(d);
    const moves = bookings.filter((b) => b.date === date).sort((a, b) => a.dep.localeCompare(b.dep));
    out[date] = moves.length ? [city, ...moves.map((b) => b.toCity)].join(" → ") : city;
    if (moves.length) city = moves.at(-1).toCity;
  }
  return out;
}

export function renderTrip({ bookings, events, legs, names, seats, trains, last, passengers, tripStart, tripEnd, startCity, planned = [], nav = "", weather = {}, plan: PLAN = {}, hotels = [], rates = null }) {
  if (!tripStart) return `<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:24px">${nav}<p>No trip data yet. Upload trip.json to KV (see README).</p>`;
  const moves = [...bookings, ...planned];
  seats ??= {}; trains ??= {};
  const start = new Date(tripStart + "T00:00:00Z");
  const end = new Date(tripEnd + "T00:00:00Z");

  // Watched trains per date, from KV: seats { "2030-05-01 760Ф": 0 } and trains { same key: details }.
  const watched = {};
  for (const [key, n] of Object.entries(seats)) {
    const [date, number] = key.split(" ");
    (watched[date] ??= []).push({ number, n, ...(trains[key] ?? {}) });
  }
  for (const list of Object.values(watched)) list.sort((a, b) => (a.dep ?? "").localeCompare(b.dep ?? ""));

  const isPref = (key) => trains[key]?.preferred !== false;
  const prefKeys = Object.keys(seats).filter(isPref);
  const hits = prefKeys.filter((k) => seats[k] >= passengers).length;
  const cities = citiesByDate(moves, startCity, start, end);

  // Calendar: a route bar (days per city) and a strip of day cards for the trip days only.
  const stayCity = {}; // city where the daytime is spent: a morning departure counts as the destination
  {
    let city = startCity;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const date = iso(d);
      const today = moves.filter((b) => b.date === date).sort((x, y) => x.dep.localeCompare(y.dep));
      stayCity[date] = today.length && today[0].dep < "12:00" ? today[0].toCity : city;
      if (today.length) city = today.at(-1).toCity;
    }
  }
  const segments = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const c = stayCity[iso(d)];
    if (segments.at(-1)?.city === c) segments.at(-1).days++;
    else segments.push({ city: c, days: 1, from: d, first: iso(d) });
  }
  const cityClass = (c) => `c-${String(c).toLowerCase().replace(/[^a-z]/g, "")}`;
  const routeBar = segments.map((sg) => `
    <div class="seg ${cityClass(sg.city)}" style="flex:${sg.days}">
      <b>${esc(sg.city)}</b><span>${sg.days} day${sg.days > 1 ? "s" : ""} · from ${dayLabel(sg.from, { day: "numeric", month: "short" })}</span>
    </div>`).join("");

  const dayCards = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const date = iso(d);
    const marks = [
      ...events.filter((e) => e.date === date).map((e) => `<span class="mk event">✈️ ${esc(e.time)}</span>`),
      ...bookings.filter((b) => b.date === date).map((b) => `<span class="mk booked">🎫 ${esc(b.dep)}</span>`),
      ...planned.filter((p) => p.date === date).map(() => `<span class="mk plan">⏳ to book</span>`),
      ...legs.filter((l) => l.date === date).map((l) => {
        const hit = (watched[date] ?? []).some((t) => t.preferred !== false && t.n >= passengers && (!t.from || t.from === l.from));
        return `<span class="mk ${hit ? "hit" : "watch"}">${hit ? "★ seats" : "☆ watching"}</span>`;
      }),
    ];
    const seg = segments.find((sg) => sg.first === date);
    if (seg) dayCards.push(`<div class="grp ${cityClass(seg.city)}"><b>${esc(seg.city)}</b><span>${seg.days} day${seg.days > 1 ? "s" : ""}</span></div>`);
    dayCards.push(`
    <a class="dc ${cityClass(stayCity[date])}" href="#d${date}">
      <span class="dc-wd">${dayLabel(d, { weekday: "short" })}</span>
      <span class="dc-num">${d.getUTCDate()}</span>
      <span class="dc-city">${esc(cities[date])}</span>${(() => { const w = weather[stayCity[date]]?.[date]; return w ? `<span class="dc-wx">${WX(w.code)[0]} ${w.max}°</span>` : ""; })()}
      <span class="dc-marks">${marks.join("")}</span>
    </a>`);
  }

  // Day-by-day agenda
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const date = iso(d);
    const blocks = [];
    const plan = PLAN[date] ?? [];
    const timeline = [];
    for (const e of events.filter((e) => e.date === date)) {
      if (plan.some((x) => x.time === e.time)) continue; // the plan slot already covers it
      timeline.push({ time: e.time, html: `<div class="card event-card"><span class="time-sm">${esc(e.time)}</span> ${esc(e.title)}</div>` });
    }
    for (const x of plan) timeline.push({ time: x.time, html: slotHtml(x) });
    for (const b of bookings.filter((b) => b.date === date)) {
      const meta = [
        `<span class="pill">🚆 ${esc(b.train)} · ${esc(b.kind)}</span>`,
        b.car && `<span class="pill">Car ${esc(b.car)} · ${esc(b.carClass)}</span>`,
        b.seat && `<span class="pill">💺 ${esc(b.seat)}</span>`,
        b.price && `<span class="pill">💰 ${esc(money(b.price, "UZS", rates))}${b.perPerson ? " per person" : ""}</span>`,
      ].filter(Boolean).join("");
      timeline.push({ time: b.dep, html: `
      <div class="card booked-card">
        <div class="card-head"><span class="badge ok">Booked</span></div>
        ${journey({ dep: b.dep, arr: b.arr, from: b.from, to: b.to, duration: durOf(b), nextDay: b.arrDate !== b.date })}
        <div class="pills">${meta}</div>
        ${b.note ? `<div class="note">ℹ️ ${esc(b.note)}</div>` : ""}${fileLinks(b.files, "🎫 Open ticket")}
      </div>` });
    }
    for (const h of hotels.filter((h) => h.checkIn === date)) timeline.push({ time: h.checkInTime || "14:00", html: hotelCard(h, rates) });
    for (const h of hotels.filter((h) => h.checkOut === date)) {
      timeline.push({ time: h.checkOutTime || "12:00", html: slotHtml({ time: h.checkOutTime || "12:00", tag: "tip", title: `Check out: ${h.name}`, note: "Take the registration slip." }) });
    }
    const sorted = withSortKeys(timeline).map((x, i) => ({ ...x, i })).sort((a, b) => a.key.localeCompare(b.key) || a.i - b.i);
    if (sorted.length) blocks.push(`<div class="timeline">${sorted.map((x) => x.html).join("")}</div>`);
    for (const leg of legs.filter((l) => l.date === date)) {
      const dep = leg.from, arv = leg.to;
      const list = (watched[date] ?? []).filter((t) => !t.from || t.from === dep);
      // Ticket numbers carry a car-type suffix (752ЖА) that the API number (752Ж) does not.
      const isBooked = (t) => bookings.some((b) => b.date === date && b.train.startsWith(t.number));
      const rows = list.map((t) => `
        <div class="row ${isBooked(t) ? "booked" : t.preferred !== false ? "pref" : "other"} ${t.n >= passengers ? "hit" : ""}">
          <div class="tn"><b>${esc(t.number)}</b>${isBooked(t) ? '<em class="ptag btag">🎫 Booked</em>' : t.preferred !== false ? '<em class="ptag">★ Preferred</em>' : ""}<span>${esc(t.brand ?? "")}${t.type && FAST_TYPES.has(t.type) ? " · fast" : ""}</span></div>
          <div class="tt">${t.dep ? `${esc(t.dep)} → ${esc(t.arr)}${t.arrDate && t.arrDate.split(".").reverse().join("-") !== date ? "<sup>+1</sup>" : ""}` : "—"}</div>
          <div class="td">${t.duration ? durOf(t) : ""}</div>
          <div class="ts"><span class="seats">${t.n} free</span></div>
        </div>`).join("");
      const prefList = list.filter((t) => t.preferred !== false), prefHit = prefList.some((t) => t.n >= passengers);
      blocks.push(`
      <details class="card watch-card"${prefHit ? " open" : ""}>
        <summary class="card-head">
          <span class="route">🔎 Alternative trains: ${esc(names[dep])} → ${esc(names[arv])}
            <small>${esc(leg.why)} · leaves ${esc(leg.after)}–${esc(leg.before === "24:00" ? "23:59" : leg.before)}</small></span>
          ${(() => { const p = list.filter((t) => t.preferred !== false); const h = p.some((t) => t.n >= passengers);
            return `<span class="badge ${h ? "hit" : ""}">${!p.length ? "No preferred train" : h ? "Preferred seats found" : "Preferred sold out"}</span>`; })()}
        </summary>
        ${rows ? `<div class="rows">${rows}</div>` : `<div class="empty-msg">No trains run on this route this day.</div>`}
      </details>`);
    }
    for (const p of planned.filter((p) => p.date === date)) {
      blocks.push(`<div class="card plan-card"><span class="badge">Not booked yet</span> ${esc(p.title)}</div>`);
    }
    if (!blocks.length) blocks.push(`<div class="stay">Staying in ${esc(cities[date])}</div>`);
    days.push(`
    <section class="day" id="d${date}">
      <div class="day-head"><span class="dnum">${d.getUTCDate()}</span>
        <span class="dname">${dayLabel(d, { weekday: "long" })}<small>${dayLabel(d, { month: "long", year: "numeric" })}</small>
        <span class="dcity">📍 ${esc(cities[date])}</span>${wxHtml(weather[stayCity[date]]?.[date], "wx", stayCity[date], date)}</span></div>
      <div class="day-body">${blocks.join("")}</div>
    </section>`);
  }

  // Today card: what matters now, in Tashkent time. Before the trip it previews day 1.
  const TZ = "Asia/Tashkent";
  const now = new Date();
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const nowHM = now.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const nextTrain = bookings.map((b) => ({ ...b, at: `${b.date} ${b.dep}` })).sort((a, b) => a.at.localeCompare(b.at))
    .find((b) => b.at >= `${todayIso} ${nowHM}`);
  const daysTo = Math.round((start - new Date(todayIso + "T00:00:00Z")) / 86400000);
  let todayCard = "";
  if (todayIso <= iso(end)) {
    const showDate = daysTo > 0 ? iso(start) : todayIso;
    const slots = PLAN[showDate] ?? [];
    const nextIdx = daysTo > 0 ? -1 : slots.findIndex((x) => x.time && x.time >= nowHM);
    const heading = daysTo > 0
      ? `Trip starts in ${daysTo} day${daysTo > 1 ? "s" : ""} <small>Day 1 · ${dayLabel(start, { weekday: "short", day: "numeric", month: "short" })} · ${esc(cities[iso(start)])}</small>`
      : `Today <small>${dayLabel(new Date(todayIso + "T00:00:00Z"), { weekday: "long", day: "numeric", month: "short" })} · 📍 ${esc(cities[todayIso])}</small>`;
    const train = nextTrain ? `<div class="next-train">🚆 Next train <b>${esc(nextTrain.dep)}</b> ${esc(nextTrain.date.slice(8))}.${esc(nextTrain.date.slice(5, 7))} ·
      ${esc(nextTrain.from)} → ${esc(nextTrain.to)} · ${esc(nextTrain.train)}</div>` : "";
    const tw = weather[stayCity[showDate]]?.[showDate];
    todayCard = `<section class="today"><h2>${heading}</h2>${tw ? `<div class="today-wx">${wxHtml(tw, "wx big", stayCity[showDate], showDate)}
      <span class="wx-tip">Tap for the hour-by-hour forecast on yr.no.</span></div>` : ""}${train}
      <div class="timeline compact">${slots.map((x, i) => slotHtml(x, i === nextIdx ? "next" : i < nextIdx ? "past" : "")).join("")}</div>
      <a class="today-link" href="#d${showDate}">Open the full day →</a></section>`;
  }

  // Server text is in Tashkent time; the script below rewrites it as "3 min ago · 15:05 your time".
  const hhmm = (tz) => new Date(last.at).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const when = last ? `<span class="ago" data-at="${esc(last.at)}" data-tas="${hhmm("Asia/Tashkent")}">${hhmm("Asia/Tashkent")} Tashkent time</span>` : "";
  const statusPill = !last ? `<span class="live off">No check yet</span>`
    : last.ok ? `<span class="live">Live · checked ${when}</span>`
    : `<span class="live err" title="${esc(last.error)}">Error · ${when}</span>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Uzbekistan Trip</title>
<meta http-equiv="refresh" content="300">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#f4f4f7;--surface:#ffffff;--surface-2:#f0f0f4;--text:#15151a;--muted:#6e6e7a;--line:#e4e4ea;
--accent:#4f46e5;--ok:#16a34a;--ok-bg:#dcfce7;--hit:#d97706;--hit-bg:#fef3c7;--event:#2563eb;--event-bg:#dbeafe;--shadow:0 1px 2px rgba(20,20,30,.04),0 8px 24px rgba(20,20,30,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#0d0d11;--surface:#17171d;--surface-2:#1f1f27;--text:#f1f1f4;--muted:#8d8d99;--line:#2a2a33;
--accent:#818cf8;--ok:#4ade80;--ok-bg:#12301f;--hit:#fbbf24;--hit-bg:#3a2a0a;--event:#60a5fa;--event-bg:#14233d;--shadow:none}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1040px;margin:0 auto;padding:32px 16px 64px}
header{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:12px;margin-bottom:24px}
h1{font-size:32px;font-weight:800;letter-spacing:-.03em;margin:0;line-height:1.1}
.sub{color:var(--muted);margin-top:6px}
.live{display:inline-block;padding:6px 12px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-size:13px;font-weight:500}
.live::before{content:"";display:inline-block;vertical-align:middle;margin-right:8px;width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 4px var(--ok-bg);animation:pulse 2s infinite}
.live.err::before{background:#ef4444;box-shadow:0 0 0 4px #ef444433}.live.off::before{background:var(--muted);animation:none}
@keyframes pulse{50%{opacity:.4}}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow)}
.stat b{display:block;font-size:26px;font-weight:700;letter-spacing:-.02em}.stat span{color:var(--muted);font-size:13px}
.stat.hit b{color:var(--hit)}
.cal{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:var(--shadow);margin-bottom:36px}
.cal-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:12px}
.c-tashkent{--city:#3b82f6}.c-samarkand{--city:#0d9488}.c-bukhara{--city:#d97706}.c-khiva{--city:#c2410c}
.route-bar{display:flex;gap:4px;margin-bottom:16px}
.seg{min-width:0;border-radius:12px;padding:10px 12px;background:color-mix(in srgb,var(--city) 16%,transparent);border-top:4px solid var(--city)}
.seg b{display:block;font-size:14px;color:var(--city);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.seg span{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.strip{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}.grp{display:none}
.dc{display:flex;flex-direction:column;gap:2px;padding:10px 8px;border-radius:14px;background:var(--surface-2);color:inherit;text-decoration:none;
  border-top:4px solid var(--city);transition:transform .15s,box-shadow .15s;min-width:0}
.dc:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.dc-wd{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.dc-num{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1.1}
.dc-city{font-size:12px;font-weight:600;color:var(--city);line-height:1.25;min-height:30px}
.dc-marks{display:flex;flex-direction:column;gap:3px;margin-top:4px}
.mk{font-size:11px;font-weight:600;padding:2px 6px;border-radius:6px;white-space:nowrap;width:fit-content}
.mk.booked{background:var(--ok-bg);color:var(--ok)}.mk.event{background:var(--event-bg);color:var(--event)}
.mk.plan{background:transparent;color:var(--muted);border:1px dashed var(--line)}
.plan-card{border-style:dashed;box-shadow:none;color:var(--muted);font-size:14px}
.mk.hit{background:var(--hit-bg);color:var(--hit)}.mk.watch{background:transparent;color:var(--muted);padding-left:0}
.legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:14px}
.dcity{margin-top:6px;font-size:13px;font-weight:600;color:var(--accent)}
.route small{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-top:2px}.star{color:var(--hit)}
.stay{color:var(--muted);font-size:14px;padding:10px 0}
.day{display:grid;grid-template-columns:150px 1fr;gap:20px;padding:20px 0;border-top:1px solid var(--line);scroll-margin-top:12px}
.day-head{display:flex;gap:10px;align-items:baseline;position:sticky;top:12px;align-self:start}
.dnum{font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:1}
.dname{font-weight:600;display:flex;flex-direction:column}.dname small{color:var(--muted);font-weight:400;font-size:12px}
.day-body{display:flex;flex-direction:column;gap:12px;min-width:0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px 18px;box-shadow:var(--shadow)}
.booked-card{border-left:4px solid var(--ok)}
.event-card{background:var(--event-bg);border-color:transparent;color:var(--event);font-weight:600;box-shadow:none}
.time-sm{font-variant-numeric:tabular-nums;margin-right:6px}
.card-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
.route{font-weight:700;font-size:16px}
.badge{font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--surface-2);color:var(--muted);white-space:nowrap}
.badge.ok{background:var(--ok-bg);color:var(--ok)}.badge.hit{background:var(--hit-bg);color:var(--hit)}
.journey{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px}
.time{font-size:28px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.1}
.time sup,.tt sup{font-size:.5em;color:var(--hit);margin-left:2px}
.station{color:var(--muted);font-size:13px;margin-top:2px}.right{text-align:right}
.line{position:relative;height:2px;background:repeating-linear-gradient(90deg,var(--line) 0 6px,transparent 6px 10px);margin:0 4px}
.line::before,.line::after{content:"";position:absolute;top:-4px;width:10px;height:10px;border-radius:50%;border:2px solid var(--accent);background:var(--surface)}
.line::before{left:-6px}.line::after{right:-6px;background:var(--accent)}
.dur{position:absolute;left:50%;top:-12px;transform:translate(-50%,-50%);font-size:12px;font-weight:600;color:var(--muted);background:var(--surface);padding:0 8px;white-space:nowrap}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.pill{font-size:12px;font-weight:500;padding:4px 10px;border-radius:8px;background:var(--surface-2)}
.note{margin-top:12px;font-size:13px;padding:8px 12px;border-radius:10px;background:var(--hit-bg);color:var(--hit);font-weight:500}
.rows{display:flex;flex-direction:column}
.row{display:grid;grid-template-columns:minmax(0,1.3fr) 1.2fr .8fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
.row:first-child{border-top:0;padding-top:0}
.tn b{font-weight:700}.tn span{display:block;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt{font-weight:600}.ptag{font-style:normal;font-size:11px;font-weight:700;color:var(--hit);background:var(--hit-bg);padding:1px 7px;border-radius:999px;margin-left:8px}
.row.other{opacity:.6}.ptag.btag{color:var(--ok);background:var(--ok-bg)}
.row.booked{background:var(--ok-bg);margin:0 -10px;padding-left:10px;padding-right:10px;border-radius:12px;border-top-color:transparent}
.row.booked + .row{border-top-color:transparent}.td{color:var(--muted);font-size:13px}
.seats{font-size:12px;font-weight:600;padding:3px 8px;border-radius:999px;background:var(--surface-2);color:var(--muted)}
.row.hit .seats{background:var(--hit-bg);color:var(--hit)}
.empty-msg{color:var(--muted);font-size:14px}
footer{color:var(--muted);font-size:13px;margin-top:24px}
.wx-tip{display:block;font-size:12px;color:var(--muted);margin:-6px 0 12px}
.wx{text-decoration:none;display:inline-block;margin-top:6px;font-size:12px;font-weight:600;color:var(--muted);background:var(--surface-2);padding:3px 8px;border-radius:999px;white-space:nowrap}
.wx.big{font-size:14px;padding:6px 12px;margin:0 0 12px;background:color-mix(in srgb,var(--surface) 80%,transparent);color:var(--text)}
.dc-wx{font-size:12px;font-weight:600;color:var(--muted)}
.ru{margin-top:8px;padding:8px 10px;border-radius:10px;background:var(--surface-2);font-size:15px;line-height:1.4}
.hotel-card{border-left:4px solid var(--event-b)}.maplink{display:block;margin-top:4px;color:var(--accent);text-decoration:none;font-size:14px}
.files{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.file{font-size:13px;font-weight:600;padding:6px 10px;border-radius:10px;background:var(--surface-2);color:var(--accent);text-decoration:none}
.timeline{display:flex;flex-direction:column;gap:10px}
.slot{display:grid;grid-template-columns:48px 28px 1fr;gap:8px;align-items:start;padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:14px}
.slot .st{font-weight:700;font-variant-numeric:tabular-nums;padding-top:1px}.slot .sdot{font-size:16px;line-height:1.3}
.slot .sb b{font-weight:600}.slot .sb p{margin:3px 0 0;color:var(--muted);font-size:13px;line-height:1.45}
.schips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.chip-cost{font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--surface-2);color:var(--text)}
.chip-book{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--hit-bg);color:var(--hit)}
.slot.next{border:2px solid var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 15%,transparent)}.slot.past{opacity:.5}
.today{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--surface)),var(--surface));border:1px solid var(--line);border-radius:22px;padding:18px;margin-bottom:20px;box-shadow:var(--shadow)}
.today h2{margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:-.02em}.today h2 small{display:block;font-size:13px;font-weight:600;color:var(--muted);letter-spacing:0;margin-top:2px}
.today .slot{background:color-mix(in srgb,var(--surface) 85%,transparent)}
.next-train{margin-bottom:12px;padding:10px 12px;border-radius:12px;background:var(--ok-bg);color:var(--ok);font-weight:600;font-size:14px}
.today-link{display:inline-block;margin-top:12px;font-weight:600;color:var(--accent);text-decoration:none}
details.watch-card>summary{list-style:none;cursor:pointer;margin-bottom:0}details.watch-card>summary::-webkit-details-marker{display:none}
details.watch-card[open]>summary{margin-bottom:10px}details.watch-card{padding:12px 16px}
details.watch-card .route{font-size:14px}
@media print{.tn-bar,.watch-card,.stats,.cal,.today{display:none}.card,.slot{box-shadow:none;break-inside:avoid}}
@media (max-width:760px){
  h1{font-size:26px}.stats{gap:8px}.stat{padding:12px}.stat b{font-size:22px}
  .cal{padding:14px}.route-bar{display:none}
  .strip{display:flex;flex-direction:column;gap:0}
  .grp{display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 6px;padding-left:2px}
  .grp:first-child{margin-top:0}.grp b{color:var(--city);font-size:15px}.grp span{color:var(--muted);font-size:12px}
  .dc{display:grid;grid-template-columns:44px 1fr;grid-template-areas:"wd city" "num marks";column-gap:12px;row-gap:0;align-items:center;
    padding:8px 12px;border-top:0;border-left:4px solid var(--city);border-radius:12px;margin-bottom:4px}
  .dc:hover{transform:none}
  .dc-wd{grid-area:wd}.dc-num{grid-area:num;font-size:22px}
  .dc-city{grid-area:city;min-height:0;font-size:14px}
  .dc-marks{grid-area:marks;flex-direction:row;flex-wrap:wrap;margin-top:2px}
  .day{grid-template-columns:1fr;gap:12px}.day-head{position:static}.dnum{font-size:32px}
  .time{font-size:22px}.slot{grid-template-columns:42px 22px 1fr;padding:9px 10px}.row{grid-template-columns:1fr auto;row-gap:2px}.tt{order:3}.td{order:4;text-align:right}
}
</style></head><body>${nav}<main>
<header>
  <div><h1>Uzbekistan trip 🇵🇱</h1><div class="sub">${dayLabel(start, { day: "numeric", month: "short" })} – ${dayLabel(end, { day: "numeric", month: "short", year: "numeric" })} · 2 travellers</div></div>
  ${statusPill}
</header>
${todayCard}
<div class="stats">
  <div class="stat"><b>${bookings.length}</b><span>booked</span></div>
  <div class="stat"><b>${prefKeys.length}</b><span>preferred trains</span></div>
  <div class="stat ${hits ? "hit" : ""}"><b>${hits}</b><span>with ${passengers}+ seats</span></div>
</div>
<div class="cal">
  <div class="cal-title">Route · ${dayLabel(start, { month: "long", year: "numeric" })}</div>
  <div class="route-bar">${routeBar}</div>
  <div class="strip">${dayCards.join("")}</div>
  <div class="legend"><span class="mk booked">🎫 booked</span><span class="mk hit">★ preferred seats</span><span class="mk watch">☆ watching, sold out</span></div>
</div>
${days.join("")}
<footer>Checks run every 5 minutes; this page reloads on its own. Times are local (Tashkent, UTC+5). <sup style="color:var(--hit)">+1</sup> = arrives the next day. <span class="star">★</span> = preferred alternative, alerts are marked ⭐.</footer>
</main>
<script>
function ago() {
  for (const el of document.querySelectorAll(".ago")) {
    const at = new Date(el.dataset.at), min = Math.max(0, Math.round((Date.now() - at) / 60000));
    const rel = min < 1 ? "just now" : min < 60 ? min + " min ago" : Math.floor(min / 60) + " h ago";
    const local = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    el.textContent = rel + " · " + local + " your time · " + el.dataset.tas + " Tashkent";
  }
}
ago(); setInterval(ago, 30000);
// yr.no opens day N of its 9-day forecast with ?i=N, counted from today in Uzbekistan.
function yrDays() {
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) + "T00:00:00Z");
  for (const a of document.querySelectorAll("a[data-yr][data-date]")) {
    const i = Math.round((new Date(a.dataset.date + "T00:00:00Z") - today) / 86400000);
    a.href = i >= 0 && i <= 8 ? "https://www.yr.no/en/forecast/hourly-table/" + a.dataset.yr + "?i=" + i
      : "https://www.yr.no/en/forecast/daily-table/" + a.dataset.yr;
  }
}
yrDays();
// Keep ticket and booking files available offline (stations and trains often have no signal).
if ("caches" in window) caches.open("uz-trip-v1").then((c) => c.addAll([...new Set([...document.querySelectorAll("a.file")].map((a) => a.getAttribute("href")))])).catch(() => {});
</script>
</body></html>`;
}
