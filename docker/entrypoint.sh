#!/bin/sh
set -eu

mkdir -p /app/data

if [ ! -f /app/data/store.json ]; then
  if [ "${USE_DOCKER_STORE:-}" = "1" ] && [ -f /app/data/store.docker.example.json ]; then
    cp /app/data/store.docker.example.json /app/data/store.json
    echo "Created data/store.json from Docker template"
  elif [ -f /app/data/store.example.json ]; then
    cp /app/data/store.example.json /app/data/store.json
    echo "Created data/store.json from example"
  fi
fi

exec "$@"
