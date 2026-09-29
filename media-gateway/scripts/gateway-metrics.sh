#!/usr/bin/env bash
set -euo pipefail
while true; do
  paths="$(curl --silent --max-time 3 http://127.0.0.1:9997/v3/paths/list || printf '{"items":[]}')"
  publishers="$(printf '%s' "$paths" | jq '[.items[]? | select(.name|startswith("ingest_"))] | length')"
  viewers="$(printf '%s' "$paths" | jq '[.items[]?.readers[]? | select(.type=="WebRTCSession")] | length')"
  gateway_host="${PARAGON_GATEWAY_HOST:?}"
  payload="$(jq -nc --arg gatewayId "${PARAGON_GATEWAY_ID:-gateway-primary-us-central1}" --arg region "${PARAGON_GATEWAY_REGION:-us-central1}" \
    --arg publicUrl "${PARAGON_GATEWAY_PUBLIC_URL:-https://${gateway_host}:8889}" \
    --arg rtmpsUrl "${PARAGON_GATEWAY_RTMPS_URL:-rtmps://${gateway_host}:1936}" \
    --arg srtUrl "${PARAGON_GATEWAY_SRT_URL:-srt://${gateway_host}:8890}" \
    --argjson activePublishers "$publishers" --argjson activeViewers "$viewers" \
    '{gatewayId:$gatewayId,region:$region,role:"origin-viewer",publicUrl:$publicUrl,rtmpsUrl:$rtmpsUrl,srtUrl:$srtUrl,healthy:true,activePublishers:$activePublishers,activeViewers:$activeViewers,cpu:0,memory:0,networkLoad:0,turnAllocations:0,zombieProcessCount:0}')"
  curl --silent --show-error --max-time 5 -H "Authorization: Bearer ${PARAGON_GATEWAY_SERVER_TOKEN:?}" -H "Content-Type: application/json" \
    --data "$payload" "${PARAGON_BACKEND_URL:?}/internal/live/media-gateway/metrics" >/dev/null || true
  sleep 15
done
