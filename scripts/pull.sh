#!/usr/bin/env bash
# Download the live private trip data from the Worker's KV namespace, the counterpart of upload.sh.
#   KV "trip"         -> trip.json
#   KV "file:<path>"  -> files/<path>
# Run this before editing, on any machine (Mac or a cloud session). Needs CLOUDFLARE_API_TOKEN with
# "Workers KV Storage: Edit" (or a wrangler login). Run from the repo root: scripts/pull.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d worker/node_modules ] || (cd worker && npm ci --silent)
kv() { (cd worker && npx wrangler kv "$@" --binding STATE --remote); }
kv key get trip > trip.json.tmp && node -e 'JSON.parse(require("fs").readFileSync("trip.json.tmp","utf8"))' && mv trip.json.tmp trip.json
echo "downloaded trip.json"
kv key list --prefix "file:" | node -e 'for (const k of JSON.parse(require("fs").readFileSync(0,"utf8"))) console.log(k.name.slice(5))' |
while read -r name; do
  mkdir -p "files/$(dirname "$name")"
  kv key get "file:$name" > "files/$name"
  echo "downloaded files/$name"
done
