// Replace one day of the day plan in a trip.json: node scripts/merge-plan.mjs <day.json> <trip.json>
// day.json is {"date": "YYYY-MM-DD", "slots": [{ time, tag, title, note, cost, book }]}. trip.json is
// rewritten in place. Used by the "Update day plan" workflow; prints no plan content (the logs are public).
import { readFileSync, writeFileSync } from "node:fs";

const [dayPath, tripPath] = process.argv.slice(2);
const fail = (msg) => { console.error(`merge-plan: ${msg}`); process.exit(1); };
if (!dayPath || !tripPath) fail("usage: merge-plan.mjs <day.json> <trip.json>");

let day, trip;
try { day = JSON.parse(readFileSync(dayPath, "utf8")); } catch { fail("the day is not valid JSON"); }
try { trip = JSON.parse(readFileSync(tripPath, "utf8")); } catch { fail("the stored trip is not valid JSON"); }

const TAGS = new Set(["sight", "food", "move", "tip"]);
const KEYS = new Set(["time", "tag", "title", "note", "cost", "book"]);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day?.date ?? "")) fail("date must be YYYY-MM-DD");
if (trip.start && trip.end && (day.date < trip.start || day.date > trip.end)) fail("date is outside the trip");
if (!Array.isArray(day.slots) || !day.slots.length) fail("slots must be a non-empty array");
day.slots.forEach((s, i) => {
  if (typeof s?.title !== "string" || !s.title) fail(`slot ${i + 1} has no title`);
  if (s.time && !/^\d{2}:\d{2}$/.test(s.time)) fail(`slot ${i + 1}: time must be HH:MM`);
  if (s.tag && !TAGS.has(s.tag)) fail(`slot ${i + 1}: unknown tag`);
  const extra = Object.keys(s).filter((k) => !KEYS.has(k));
  if (extra.length) fail(`slot ${i + 1}: unknown field ${extra[0]}`);
});

trip.plan = { ...(trip.plan ?? {}), [day.date]: day.slots };
writeFileSync(tripPath, JSON.stringify(trip, null, 2) + "\n");
console.log(`merge-plan: replaced the day with ${day.slots.length} slots`);
