#!/usr/bin/env bash
set -euo pipefail
. /opt/paragon/path-identifiers.sh

config_json="$(curl --fail --silent --show-error \
  --connect-timeout 5 --max-time 10 \
  -H "Authorization: Bearer ${PARAGON_GATEWAY_SERVER_TOKEN:?}" \
  "${PARAGON_BACKEND_URL:?}/internal/live/media-gateway/restream?sessionId=${PARAGON_SESSION_ID}&mediaGeneration=${PARAGON_MEDIA_GENERATION}")"
cloudflare_rtmps="$(printf '%s' "$config_json" | jq -er '.cloudflareRtmps')"

/opt/paragon/gateway-event.sh ingest-online || true

input_url="rtsp://paragon:${PARAGON_GATEWAY_INTERNAL_TOKEN:?}@127.0.0.1:8554/${MTX_PATH}"
playback_path="live_${PARAGON_SESSION_ID}_${PARAGON_MEDIA_GENERATION}"
playback_url="rtsp://paragon:${PARAGON_GATEWAY_INTERNAL_TOKEN}@127.0.0.1:8554/${playback_path}"

exec ffmpeg -hide_banner -loglevel warning -nostdin -rtsp_transport tcp -i "$input_url" \
  -map 0:v:0 -map 0:a:0? -c:v copy -c:a libopus -application lowdelay -frame_duration 20 -ar 48000 -ac 2 -f rtsp -rtsp_transport tcp "$playback_url" \
  -map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -tune zerolatency -profile:v high -level 4.1 -g 60 -keyint_min 60 -sc_threshold 0 -b:v 2500k -maxrate 2500k -bufsize 5000k \
  -c:a aac -b:a 128k -ar 48000 -ac 2 -f flv "$cloudflare_rtmps"

