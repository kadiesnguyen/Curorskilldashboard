#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f data/store.json ]]; then
  cp data/store.example.json data/store.json
  echo "Created data/store.json from example"
fi
exec node server.mjs
