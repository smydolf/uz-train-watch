# uz-train-watch

A small trip companion for a rail trip through Uzbekistan, running as one Cloudflare Worker:

- **Seat watcher**: every 5 minutes it checks eticket.uzrailpass.uz for the trains you watch and sends
  Telegram alerts when seats appear, and low-seat warnings (below 10 and 6 seats).
- **/app**: the phone app, with 4 tabs. `/` and the old `/trip` and `/guide` links open it.
  - **NOW** shows what to do now and next, tonight's train or hotel, and the stops left today.
  - **DAY** shows one day as a route line, with Maps links and Skip.
  - **TRIP** shows the whole journey, with computed warnings, trains, hotels and slips.
  - **TOOLS** has the UZS → PLN converter, a kit checklist, emergency numbers and tonight's hotel
    in Russian for the taxi driver.
The app is behind a password sign-in (one account) and works offline after one visit.

## The app (/app)

- All "now" logic uses Tashkent time (UTC+5), not the phone's time, except on days listed in `zones`. To test
  another moment, add `?at=2026-10-02T12:40` (that day's local time) to the URL, for example `/app?at=2026-10-05T08:30#day/2026-10-05`.
- Tabs have their own URLs: `#now`, `#day/2026-10-02`, `#trip`, `#tools`.
- In a Safari tab the tabs sit at the top, clear of Safari's address bar. When you open the app from the
  Home Screen ("Add to Home Screen"), the tabs move to the bottom. TOOLS → Navigation overrides this.
- Kit items, skipped stops and the navigation setting are kept on each phone, in `localStorage` key
  `tripagent.uz.v1`. The kit starts from `kit` in `trip.json` when it is there. Registration-slip ticks are kept under `uz-checks`.
- Optional fields in `trip.json` that the app uses (see `trip.example.json`):
  - on plan items: `kind` (move, food, sight, train, hotel or note; else taken from `tag`), `map`, `leg`
    (transport to the next stop, for example `Taxi 4 km · 10 min`), `book`, `links` and `id` (a stable id
    for skips; else the title is used);
  - on hotels: `phone`, `nameLocal`, `addressLocal`, `payment` (for example `50% prepaid`);
  - on bookings: `refundUntil` (for example `2026-10-02T18:48`; else it is read from the note), `mode: "flight"`
    for a flight (it is not counted as a train), and `duration` (for example `06:00`) when the arrival is in
    another time zone;
  - `kit` at the top level: the TOOLS kit checklist (here, the packing list), a list of strings. It replaces the
    default kit. When it changes, it replaces the kit on each phone: ticks carry over by label, and items added on
    the phone stay;
  - `zones` at the top level: the UTC offset of days spent outside Uzbekistan, for example
    `{ "2026-10-01": "+02:00" }` for the flight day in Poland. That day's times are local, and the app runs on that
    clock until the day ends there. Every other day is in Tashkent time.

## Private data

No personal data is in this repo. It lives in the Worker's KV namespace:

| KV key | Content | Source |
|---|---|---|
| `trip` | bookings, hotels, day plan, watched trains, registration slips | local `trip.json` (git-ignored) |
| `file:<path>` | ticket PDFs, booking confirmations | local `files/` folder (git-ignored) |
| `state` | seat history, alert state, weather cache | written by the Worker |

`trip.example.json` shows the format. After editing `trip.json` or adding files, run:

```bash
scripts/upload.sh
```

To get the live data on a new machine (it overwrites the local `trip.json` and `files/`):

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

