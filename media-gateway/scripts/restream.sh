#!/usr/bin/env bash
set -euo pipefail
. /opt/paragon/path-identifiers.sh

/opt/paragon/gateway-event.sh ingest-online || true

internal_token_encoded="$(jq -rn --arg token "${PARAGON_GATEWAY_INTERNAL_TOKEN:?}" '$token|@uri')"
input_url="rtsp://127.0.0.1:8554/${MTX_PATH}?token=${internal_token_encoded}"
playback_path="live_${PARAGON_SESSION_ID}_${PARAGON_MEDIA_GENERATION}"
playback_url="rtsp://127.0.0.1:8554/${playback_path}?token=${internal_token_encoded}"

live_pid=""

stop_children() {
  if [[ -n "$live_pid" ]]; then kill "$live_pid" 2>/dev/null || true; fi
  if [[ -n "$live_pid" ]]; then wait "$live_pid" 2>/dev/null || true; fi
}
trap stop_children EXIT
trap 'exit 0' INT TERM

# The WHEP branch is H264 stream-copy plus the required AAC-to-Opus audio conversion. It has no
# dependency on the recording branch and introduces no video re-encode or intentional buffer.
ffmpeg -hide_banner -loglevel warning -nostdin -rtsp_transport tcp -i "$input_url" \
  -map 0:v:0 -map 0:a:0? -c:v copy -c:a libopus -application lowdelay -frame_duration 20 \
  -b:a 96k -ar 48000 -ac 2 -f rtsp -rtsp_transport tcp "$playback_url" &
live_pid="$!"
wait "$live_pid"
