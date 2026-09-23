#!/bin/sh
set -eu

for directory in . client server; do
    fingerprint=$(cd "$directory" && sha256sum package.json package-lock.json | sha256sum | cut -d ' ' -f 1)
    marker="$directory/node_modules/.docker-deps-fingerprint"

    if [ ! -f "$marker" ] || [ "$(cat "$marker")" != "$fingerprint" ]; then
        npm ci --prefix "$directory" --prefer-offline --no-audit --no-fund
        printf '%s\n' "$fingerprint" > "$marker"
    fi
done

exec npm run docker:dev
