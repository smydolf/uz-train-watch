# uz-train-watch

A small trip companion for a rail trip through Uzbekistan, running as one Cloudflare Worker:

- **Seat watcher**: every 5 minutes it checks eticket.uzrailpass.uz for the trains you watch and sends
  Telegram alerts when seats appear, and low-seat warnings (below 10 and 6 seats).
- **/trip**: day-by-day plan with booked trains, hotels, ticket files, live seats and a daily weather forecast.
- **/guide**: city sheets (tickets, where to eat, scams), money, documents, phrases, checklists and a map.

Everything is behind a password sign-in (one account). Both pages work offline after one visit.

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

To replace a single day of the plan without a local `trip.json`, run the **Update day plan** workflow
(Actions tab) with the day as JSON: `{"date": "YYYY-MM-DD", "slots": [...]}`. It merges the day into the
stored trip and keeps the previous version under the KV key `trip:backup:<run id>`.

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

