#!/usr/bin/env bash
set -euo pipefail
. /opt/paragon/path-identifiers.sh

event_name="${1:?event name is required}"
curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 10 \
  -H "Authorization: Bearer ${PARAGON_GATEWAY_SERVER_TOKEN:?}" \
  -H "Content-Type: application/json" \
  --data "{\"sessionId\":\"${PARAGON_SESSION_ID}\",\"mediaGeneration\":${PARAGON_MEDIA_GENERATION},\"event\":\"${event_name}\"}" \
  "${PARAGON_BACKEND_URL:?}/internal/live/media-gateway/event" >/dev/null

