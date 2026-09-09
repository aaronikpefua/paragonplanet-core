#!/usr/bin/env bash
set -euo pipefail
envsubst '${PARAGON_BACKEND_URL} ${PARAGON_GATEWAY_HOST}' </etc/mediamtx.yml >/tmp/mediamtx.yml
exec /usr/local/bin/mediamtx /tmp/mediamtx.yml
