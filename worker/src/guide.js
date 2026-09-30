// Renders /guide: per-city sheets and trip reference (money, documents, phrases, emergency), plus the
// checklists and map kept from the first guide. Data lives in plan.js.
import { CITIES, REFERENCE, SOURCES } from "./plan.js";
import checklistsHtml from "./checklists.html";
import mapHtml from "./map.html";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const list = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

function citySheet(c, days) {
  const tickets = c.tickets.map(([name, price, hours]) =>
    `<tr><td>${esc(name)}</td><td class="num">${esc(price)}</td><td class="muted">${esc(hours)}</td></tr>`).join("");
  const food = c.food.map(([name, note, book]) =>
    `<li><b>${esc(name)}</b>${book ? '<span class="tag book">Book ahead</span>' : ""}<span class="muted"> · ${esc(note)}</span></li>`).join("");
  return `
  <section class="card city c-${c.id}" id="${c.id}">
    <div class="city-head"><h2>${esc(c.name)}</h2><span class="muted">${esc(days ?? "")}</span></div>
    <h3>🎟️ Tickets <small>UZS, 2025–26 unless marked</small></h3>
    <div class="table-wrap"><table><thead><tr><th>Sight</th><th class="num">Price</th><th>Hours / note</th></tr></thead><tbody>${tickets}</tbody></table></div>
    <h3>🍽️ Where to eat</h3><ul class="food">${food}</ul>
    <h3>⚠️ Watch out</h3>${list(c.watch)}
  </section>`;
}

const shortDate = (d) => `${+d.slice(8)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+d.slice(5, 7) - 1]}`;

export function renderGuide(nav, trip = { hotels: [], slips: [] }, rates = null) {
  // City dates come from the hotel stays in the private trip data.
  const days = Object.fromEntries(CITIES.map((c) => [c.id, (trip.hotels ?? []).filter((h) => h.city?.toLowerCase() === c.id)
    .map((h) => `${shortDate(h.checkIn)} – ${shortDate(h.checkOut)}`).join(", ")]));
  const slips = (trip.slips ?? []).length ? `  <h3>🧾 Registration slips (keep every one)</h3>
  <ul>${trip.slips.map((t, i) => `<li><label><input type="checkbox" data-id="slip-${i}-${esc(t).slice(0, 20)}"><span>${esc(t)}</span></label></li>`).join("")}</ul>` : "";
  const phrases = REFERENCE.phrases.map(([en, uz, ru]) => `<tr><td>${esc(en)}</td><td><b>${esc(uz)}</b></td><td>${esc(ru)}</td></tr>`).join("");
  const sos = REFERENCE.emergency.map(([what, num]) => `<a class="sos" href="tel:${num}"><b>${num}</b><span>${esc(what)}</span></a>`).join("");
  const sources = SOURCES.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("");
  const chips = [["tashkent", "Tashkent"], ["samarkand", "Samarkand"], ["bukhara", "Bukhara"], ["khiva", "Khiva"], ["money", "Money & SIM"],
    ["documents", "Documents"], ["etiquette", "Etiquette & phrases"], ["emergency", "Emergency"], ["checklist", "Checklists"], ["map-section", "Map"]]
    .map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Uzbekistan Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#f4f4f7;--surface:#fff;--surface-2:#f0f0f4;--text:#15151a;--muted:#6e6e7a;--line:#e4e4ea;--accent:#4f46e5;--accent-soft:#e0e7ff;
--ok:#16a34a;--ok-bg:#dcfce7;--hit:#b45309;--hit-bg:#fef3c7;--shadow:0 1px 2px rgba(20,20,30,.04),0 8px 24px rgba(20,20,30,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#0d0d11;--surface:#17171d;--surface-2:#1f1f27;--text:#f1f1f4;--muted:#8d8d99;--line:#2a2a33;
--accent:#818cf8;--accent-soft:#1e1b4b;--ok:#4ade80;--ok-bg:#12301f;--hit:#fbbf24;--hit-bg:#3a2a0a;--shadow:none}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:32px;font-weight:800;letter-spacing:-.03em;margin:0;line-height:1.1}.sub{color:var(--muted);margin:6px 0 0}
.chips{position:sticky;top:0;z-index:5;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:12px 0;margin:14px 0 4px;background:var(--bg)}
.chips::-webkit-scrollbar{display:none}
.chips a{flex:none;font-size:13px;font-weight:600;text-decoration:none;color:var(--accent);background:var(--accent-soft);padding:6px 12px;border-radius:999px}
.card,section{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px 20px;box-shadow:var(--shadow);margin-top:16px;scroll-margin-top:64px}
h2{font-size:20px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px}
h3{font-size:14px;font-weight:700;margin:18px 0 6px}h3 small{font-weight:500;color:var(--muted);font-size:12px}
ul{margin:4px 0 8px;padding-left:1.1em}li{margin:4px 0}.muted{color:var(--muted)}
a{color:var(--accent)}
.c-tashkent{--city:#3b82f6}.c-samarkand{--city:#0d9488}.c-bukhara{--city:#d97706}.c-khiva{--city:#c2410c}
.city{border-top:5px solid var(--city)}.city-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.city h2{color:var(--city)}
.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}td.num,th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.food{list-style:none;padding:0}.food li{padding:6px 0;border-bottom:1px solid var(--line)}.food li:last-child{border:0}
.tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px}.tag.book{background:var(--hit-bg);color:var(--hit)}
.sos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.sos{display:flex;flex-direction:column;padding:12px;border-radius:14px;background:var(--surface-2);color:inherit;text-decoration:none}
.sos b{font-size:24px;font-weight:800;color:var(--accent)}.sos span{font-size:13px;color:var(--muted)}
.checklists ul{list-style:none;padding-left:0}.checklists li{margin:0;border-bottom:1px solid var(--line)}.checklists li:last-child{border-bottom:0}
.checklists label{display:flex;gap:10px;align-items:flex-start;padding:9px 2px;cursor:pointer}
.checklists input{flex:none;width:20px;height:20px;margin-top:2px;accent-color:var(--accent)}
.checklists label:has(input:checked){color:var(--muted);text-decoration:line-through}
.reset{font:inherit;font-size:13px;border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:8px;padding:8px 12px;cursor:pointer}
.note{font-size:13px;color:var(--muted)}
.rate{font-size:16px;padding:10px 12px;border-radius:12px;background:var(--accent-soft)}
footer{margin-top:28px;font-size:13px;color:var(--muted)}footer a{color:var(--muted)}
@media (max-width:760px){h1{font-size:26px}}
@media print{.tn-bar,.chips,#map-section,.reset{display:none}section,.card{box-shadow:none;break-inside:avoid}}
</style></head><body>${nav}<main>
<h1>Uzbekistan guide 📖</h1>
<p class="sub">Trip reference. The day-by-day plan is on the <a href="/trip">Trip</a> page. Prices are in UZS (k = 1,000).</p>
<nav class="chips" aria-label="Sections">${chips}</nav>

${CITIES.map((c) => citySheet(c, days[c.id])).join("")}

<section id="money"><h2>💵 Money</h2>
  ${rates?.rates?.UZS ? `<p class="rate"><b>1 PLN ≈ ${Math.round(rates.rates.UZS).toLocaleString("en")} UZS</b> · 100,000 UZS ≈ ${(100000 / rates.rates.UZS).toFixed(0)} PLN
    <span class="muted"> · rate from ${esc(rates.updated?.slice(5, 16) ?? "")}</span></p>` : ""}
  ${list(REFERENCE.money)}
  <h2 style="margin-top:18px">📱 SIM & getting around</h2>${list(REFERENCE.connectivity)}</section>

<section id="documents"><h2>🛂 Documents & registration</h2>${list(REFERENCE.documents)}
  <p class="note">Tick off the slips in <a href="#checklist">Checklists</a>.</p></section>

<section id="etiquette"><h2>🙏 Etiquette</h2>${list(REFERENCE.etiquette)}
  <h3>🌤️ Weather in October</h3><p>${esc(REFERENCE.weather)}</p>
  <h3>💬 Phrases</h3>
  <div class="table-wrap"><table><thead><tr><th>English</th><th>Uzbek</th><th>Russian</th></tr></thead><tbody>${phrases}</tbody></table></div>
  <p class="note">Russian is widely understood, and English is scarce outside hotels.</p></section>

<section id="emergency"><h2>🚨 Emergency</h2><div class="sos-grid">${sos}</div></section>

${checklistsHtml.replace("<!--SLIPS-->", slips)}
${mapHtml}

<footer><h3>Sources</h3><ul>${sources}</ul>
<p>Prices and hours change: check on the spot. Facts collected in Sept 2026.</p></footer>
</main></body></html>`;
}
