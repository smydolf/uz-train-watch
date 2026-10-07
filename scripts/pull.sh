#!/usr/bin/env bash
# Download the live private trip data from the Worker's KV namespace, the counterpart of upload.sh.
#   KV "trip"         -> trip.json
#   KV "visits"       -> visits.json (BEEN THERE), KV "track:<day>" -> track.json (OwnTracks points)
#   KV "file:<path>"  -> files/<path>
# Run this before editing, on any machine (Mac or a cloud session). Needs CLOUDFLARE_API_TOKEN with
# "Workers KV Storage: Edit" (or a wrangler login). Run from the repo root: scripts/pull.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d worker/node_modules ] || (cd worker && npm ci --silent)
kv() { (cd worker && npx wrangler kv "$@" --binding STATE --remote); }
kv key get trip > trip.json.tmp && node -e 'JSON.parse(require("fs").readFileSync("trip.json.tmp","utf8"))' && mv trip.json.tmp trip.json
echo "downloaded trip.json"
# BEEN THERE (written by the app), read-only here: upload.sh never writes it back.
if kv key get visits > visits.json.tmp 2>/dev/null && node -e 'JSON.parse(require("fs").readFileSync("visits.json.tmp","utf8"))'; then
  mv visits.json.tmp visits.json; echo "downloaded visits.json"
else
  rm -f visits.json.tmp; echo "no visits yet"
fi
# The OwnTracks points, one KV key per day ("track:<day>"), merged into track.json by time.
rm -rf .track.tmp && mkdir .track.tmp
kv key list --prefix "track:" | node -e 'for (const k of JSON.parse(require("fs").readFileSync(0,"utf8"))) console.log(k.name)' |
while read -r key; do kv key get "$key" > ".track.tmp/${key#track:}.json"; done
node -e '
const fs = require("fs"), files = fs.readdirSync(".track.tmp");
const pts = files.flatMap((f) => JSON.parse(fs.readFileSync(".track.tmp/" + f, "utf8")).pts ?? []).sort((a, b) => a[0] - b[0]);
fs.writeFileSync("track.json", JSON.stringify({ pts }));
console.log(`downloaded track.json (${pts.length} points from ${files.length} days)`);'
rm -rf .track.tmp
kv key list --prefix "file:" | node -e 'for (const k of JSON.parse(require("fs").readFileSync(0,"utf8"))) console.log(k.name.slice(5))' |
while read -r name; do
  mkdir -p "files/$(dirname "$name")"
  kv key get "file:$name" > "files/$name"
  echo "downloaded files/$name"
done
