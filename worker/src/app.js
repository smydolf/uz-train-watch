// Server side of /app, the mobile trip companion (NOW · DAY · TRIP · TOOLS).
// /app is a static shell with no personal data, so the service worker can cache it safely. The shell reads
// everything from /api/app and computes "now" on the phone, in Tashkent time.
import APP_HTML from "./app.html";
import ICON_180 from "./icons/app-icon-180.png";
import ICON_512 from "./icons/app-icon-512.png";

export { APP_HTML };

export const ICONS = { "/app-icon-180.png": ICON_180, "/app-icon-512.png": ICON_512 };

export const MANIFEST = JSON.stringify({
  name: "Uzbekistan trip",
  short_name: "Trip",
  id: "/app",
  start_url: "/app#now",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#0f1012",
  theme_color: "#0f1012",
  icons: [
    { src: "/app-icon-180.png", sizes: "180x180", type: "image/png" },
    { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
});

// Uzbekistan emergency numbers for TOOLS (112 and the tourist hotline are shown large).
const EMERGENCY = [["General emergency", "112"], ["Police", "102"], ["Ambulance", "103"], ["Fire", "101"], ["Tourist hotline", "1173"]];

// Everything the page needs in one response: the trip from KV, live seats for watched trains, weather,
// exchange rates and the emergency numbers.
export function appPayload(trip, state) {
  const seats = state.seats ?? {}, trains = state.trains ?? {};
  const watch = trip.watch.map((w, i) => {
    const from = trip.legs[i].from; // station code: the watcher also stores trains of other legs on that date
    const list = Object.entries(seats)
      .filter(([k]) => k.startsWith(`${w.date} `) && (!trains[k]?.from || trains[k].from === from))
      .map(([k, n]) => ({ number: k.slice(11), n, dep: trains[k]?.dep ?? "", arr: trains[k]?.arr ?? "",
        brand: trains[k]?.brand ?? "", preferred: trains[k]?.preferred !== false }))
      .sort((a, b) => a.dep.localeCompare(b.dep));
    return { date: w.date, from: w.from, to: w.to, why: w.why ?? "", trains: list };
  });
  const { start, end, startCity, passengers, bookings, hotels, events, planned, plan, slips, zones, kit, insurance, guides, maps } = trip;
  return {
    trip: { start, end, startCity, passengers, bookings, hotels, events, planned, plan, slips, zones, kit, insurance, guides, maps },
    watch,
    last: state.last ?? null,
    weather: state.weather?.days ?? {},
    rates: state.rates?.rates ?? null,
    emergency: EMERGENCY,
  };
}
