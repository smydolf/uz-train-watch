# uz-train-watch

A small trip companion for a rail trip through Uzbekistan, running as one Cloudflare Worker:

- **Seat watcher**: every 5 minutes it checks eticket.uzrailpass.uz for the trains you watch and sends
  Telegram alerts when seats appear, and low-seat warnings (below 10 and 6 seats).
- **/app**: the phone app, with 4 tabs. `/` and the old `/trip` and `/guide` links open it.
  - **NOW** shows what to do now and next, the guides as tiles (the city guide first, then the next stops' guides),
    the city map with a "you are here" dot, tonight's train or hotel, and the stops left today. Near a café, bar or
    restaurant it asks "Are you here?" (see BEEN THERE below).
  - **DAY** shows one day as a route line, with Maps links, Done and Skip. Drag a stop by its grip to reorder the day.
  - **TRIP** shows BEEN THERE (the places we have been) first, then the whole journey: computed warnings, days, trains, hotels and slips.
  - **TOOLS** has the UZS → PLN converter, a kit checklist, emergency numbers and tonight's hotel
    in Russian for the taxi driver, the travel insurance, and the BEEN THERE settings.
The app is behind a password sign-in (one account) and works offline after one visit.

## The app (/app)

- All "now" logic uses Tashkent time (UTC+5), not the phone's time, except on days listed in `zones`. To test
  another moment, add `?at=2026-10-02T12:40` (that day's local time) to the URL, for example `/app?at=2026-10-05T08:30#day/2026-10-05`.
- Tabs have their own URLs: `#now`, `#day/2026-10-02`, `#trip`, `#tools`.
- In a Safari tab the tabs sit at the top, clear of Safari's address bar. When you open the app from the
  Home Screen ("Add to Home Screen"), the tabs move to the bottom. TOOLS → Navigation overrides this.
- Done stops count as behind you: NOW and NEXT move on to the next open stop, the same as after Skip.
- Reordering keeps the day's time slots where they are and moves the stops through them, so a stop dragged to the top
  takes the first time. Trains, events and stops without a time stay put. A stop's `leg` is hidden once the stop after it
  changes. RESET ORDER in DAY goes back to the trip.json order. On a computer, the arrow keys on a grip move it too.
- Kit items, done, skipped and reordered stops, the navigation setting, the BEEN THERE switch and its unsent changes are kept
  on each phone, in `localStorage` key `tripagent.uz.v1`. The kit starts from `kit` in `trip.json` when it is there. Registration-slip ticks are kept under `uz-checks`.
- Optional fields in `trip.json` that the app uses (see `trip.example.json`):
  - on plan items: `kind` (move, food, sight, train, hotel or note; else taken from `tag`), `map`, `leg`
    (transport to the next stop, for example `Taxi 4 km · 10 min`), `book`, `links` and `id` (a stable id
    for skips and done stops; else the title is used). A link can be `{ "label": "Guide", "file": "guides/x.html" }`:
    it opens `files/guides/x.html` and, like the tickets, is kept on the phone for offline use;
  - on hotels: `phone`, `nameLocal`, `addressLocal`, `payment` (for example `50% prepaid`);
  - on bookings: `refundUntil` (for example `2026-10-02T18:48`; else it is read from the note), `mode: "flight"`
    for a flight (it is not counted as a train), and `duration` (for example `06:00`) when the arrival is in
    another time zone;
  - `kit` at the top level: the TOOLS kit checklist (here, the packing list), a list of strings. It replaces the
    default kit. When it changes, it replaces the kit on each phone: ticks carry over by label, and items added on
    the phone stay;
  - `insurance` at the top level: travel insurance cards in TOOLS, for example
    `[{ "name": "AXA", "holder": "…", "policy": "…", "phone": "+48 …", "phoneLabel": "24/7 alarm centre", "note": "…" }]`;
  - `guides` at the top level: city pages, for example `[{ "city": "Bukhara", "title": "Bukhara", "file": "guides/buchara.html", "note": "History, maps" }]`;
    `label` replaces the tile's "CITY GUIDE" heading (for example `"TO BOOK"` for a page of tours).
    On the days spent in that city NOW shows the city guide as a tile, then a tile for each guide linked from today's
    open stops and tomorrow's (done and skipped stops drop out), then the pages with a `label`. A tile takes the link's `title`, else the stop's title when
    the link is labelled just "Guide", else the link's label. City guides are kept on the phone like the other files;
  - `maps` at the top level: the NOW map, one SVG per city, for example
    `[{ "city": "Bukhara", "file": "maps/buchara.svg", "geo": [39.7676, 39.7868, 64.3962, 64.4318], "size": [2000, 1404] }]`.
    `geo` is the map's box (south, north, west, east) in the equirectangular projection the maps are drawn in
    (x = (lon − west) · cos(mid latitude) · s, y = (north − lat) · s), `size` its width and height in pixels, shown 1:1.
    NOW shows the map you are on (else today's city's); LOCATE starts the location watch, which runs only while NOW is
    on screen and is remembered on the phone. `pois` (optional) are the points you can tap for a note:
    `[{ "n": "Labi-Hauz", "d": "1620", "t": "One line about it.", "lat": 39.7732, "lon": 64.4206, "g": "guides/labi-hauz.html" }]`
    (`g`, the guide it links to, is optional). The SVGs carry their own styles, since the app shows them as images;
  - `zones` at the top level: the UTC offset of days spent outside Uzbekistan, for example
    `{ "2026-10-01": "+02:00" }` for the flight day in Poland. That day's times are local, and the app runs on that
    clock until the day ends there. Every other day is in Tashkent time.

## BEEN THERE (the places we have been)

A list of the cafés, bars and restaurants we went to, in TRIP, shared by both phones (KV `visits`).

- **When the app opens** (TOOLS → BEEN THERE → ASK ON OPEN, on by default), the phone takes a location fix and looks up
  the food and drink places within 40–80 m in OpenStreetMap. NOW then asks "Are you here?" about the nearest, with the
  others as chips, Other… to type a name, and NOT A PLACE (never ask about this spot again, for the hotel). No hides those
  places for 3 hours. It checks again at most every 3 minutes while the app is open, and when you walk 60 m on with the
  map on. Nothing is asked at a hotel (one nearer than any café and within 35 m), or about a place already in the list.
- OpenStreetMap lacks many cafés (in Bukhara, Urban Coffee and Darvoza coffee). Where it has none, NOW asks "Where are
  you?" with a box for the name, unless you are near a sight on the city map, the fix is rougher than 100 m, or NOT NOW
  (or No) was tapped in the last 30 minutes. A place saved with coordinates is offered by name the next time you are
  there ("On your list"). TOOLS → BEEN THERE shows what the last check found.
- **I'M HERE** in TRIP looks again at once and shows every place nearby; the box under the list adds a place by name.
- The phone asks OpenStreetMap itself (Overpass, then Photon and a second Overpass server after 3 seconds), since the
  Worker's shared Cloudflare address runs into their per-address limits. OSM does not have every place: type it in.
- **In the background**, with [OwnTracks](https://apps.apple.com/app/id692424691) (free): TOOLS → 1 · Install, then
  2 · Copy address, and in OwnTracks ⓘ → Settings: Mode HTTP, paste the address into URL. (OwnTracks on iOS ignores
  configuration links: its "allow configuration by URI" setting is off and not in its UI.) Allow it location "Always".
  For routes as well as stops, use Move mode with OwnTracks' own switching: a region named `+follow` (any radius; the
  leading + makes it follow the phone), and in Settings `adapt` 5 and `downgrade` 20. After 5 minutes without moving it
  drops to Significant; leaving the follow region brings Move back; below 20 % battery it stays in Significant.
  Points go to KV `track:<UTC day>` and are kept 90 days, so the trip can be drawn afterwards. The Worker thins them per
  phone: visits, manual sends and region events always; standing still one point in 4 minutes; on foot every point 20 s
  apart; faster than 30 km/h one in 2 minutes. At most 500 writes a day, so the seat watcher's state always fits in the
  KV free tier. The app finds the stays in the last 36 hours: 5 minutes or more within 70 m, or an iOS visit. A stay
  where one place is clearly the one (the nearest within 25 m, the next 25 m further, points good to 40 m) is saved on
  its own ("saved on its own" in the list); any other stay becomes a "Were you here?" question on NOW. The token is
  derived from `APP_PASSWORD`: after changing the password, copy the new address into OwnTracks.

## Private data

No personal data is in this repo. It lives in the Worker's KV namespace:

| KV key | Content | Source |
|---|---|---|
| `trip` | bookings, hotels, day plan, watched trains, registration slips | local `trip.json` (git-ignored) |
| `file:<path>` | ticket PDFs, booking confirmations, sight guides (HTML) | local `files/` folder (git-ignored) |
| `state` | seat history, alert state, weather cache | written by the Worker |
| `visits` | BEEN THERE: the places, questions answered No, spots never to ask about | written by the app |
| `track:<day>` | OwnTracks points, one key per UTC day, kept 90 days | written by OwnTracks |

`trip.example.json` shows the format. After editing `trip.json` or adding files, run:

```bash
scripts/upload.sh
```

To get the live data on a new machine (it overwrites the local `trip.json`, `visits.json`, `track.json` and `files/`):

```bash
scripts/pull.sh
```

## Working from Claude in the cloud

A cloud session has the code from GitHub but not the private data. Give its environment:

```
CLOUDFLARE_API_TOKEN=<token with only "Account → Workers KV Storage → Edit">
CLOUDFLARE_ACCOUNT_ID=<account id>
```

and network access to `api.cloudflare.com`. Then: `scripts/pull.sh` → edit `trip.json` or add files →
`scripts/upload.sh`. Code changes go through a push to `main`; this token cannot deploy the Worker.

## Deploys

Every push to `main` deploys the Worker through GitHub Actions (`.github/workflows/deploy.yml`, secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`). Pull requests get a dry run.

## Secrets and variables (Cloudflare, not in git)

- `TELEGRAM_TOKEN`: bot token. Every private chat that messages the bot gets alerts (max 5).
- `APP_USER`, `APP_PASSWORD`: the one account for signing in. Without them nobody can sign in.
  Changing the password signs every device out.

