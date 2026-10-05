#!/usr/bin/env bash
# Upload the private trip data and files to the Worker's KV namespace.
#   trip.json  -> KV key "trip"
#   files/*    -> KV keys "file:<path>" (tickets, booking confirmations), served at /files/<path>
# Neither trip.json nor files/ is in git. Run scripts/pull.sh first on a new machine.
# Run from the repo root: scripts/upload.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d worker/node_modules ] || (cd worker && npm ci --silent)
node -e 'JSON.parse(require("fs").readFileSync("trip.json","utf8"))' # fail early on invalid JSON
(cd worker && npx wrangler kv key put trip --path ../trip.json --binding STATE --remote)
if [ -d files ]; then
  find files -type f ! -name '.*' | while read -r f; do
    name="${f#files/}"
    case "${f##*.}" in
      pdf) type=application/pdf ;; png) type=image/png ;; jpg|jpeg) type=image/jpeg ;; webp) type=image/webp ;;
      html) type=text/html ;; svg) type=image/svg+xml ;; *) type=application/octet-stream ;;
    esac
    (cd worker && npx wrangler kv key put "file:$name" --path "../$f" --binding STATE --remote --metadata "{\"type\":\"$type\"}")
    echo "uploaded $name ($type)"
  done
fi
