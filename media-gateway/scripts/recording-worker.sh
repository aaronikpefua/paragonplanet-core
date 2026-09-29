#!/usr/bin/env bash
set -euo pipefail

declare -A workers
declare -A sessions

stop_worker() {
  local path="$1" pid="${workers[$path]:-}"
  if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  unset 'workers[$path]' 'sessions[$path]'
}

cleanup() { for path in "${!workers[@]}"; do stop_worker "$path"; done; }
trap cleanup EXIT
trap 'exit 0' INT TERM

start_worker() {
  local path="$1" suffix="${path#ingest_}" generation="${suffix##*_}" session_id="${suffix%_*}"
  local config cloudflare token input_url
  config="$(curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
    -H "Authorization: Bearer ${PARAGON_GATEWAY_SERVER_TOKEN:?}" \
    "${PARAGON_BACKEND_URL:?}/internal/live/media-gateway/restream?sessionId=${session_id}&mediaGeneration=${generation}")" || return 0
  cloudflare="$(printf '%s' "$config" | jq -er '.cloudflareRtmps')" || return 0
  token="$(jq -rn --arg token "${PARAGON_GATEWAY_INTERNAL_TOKEN:?}" '$token|@uri')"
  input_url="rtsp://127.0.0.1:8554/${path}?token=${token}"
  (
    while true; do
      ffmpeg -hide_banner -loglevel warning -nostdin -rtsp_transport tcp -i "$input_url" \
        -map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -tune zerolatency -profile:v high -level 4.1 \
        -g 60 -keyint_min 60 -sc_threshold 0 -b:v 2500k -maxrate 2500k -bufsize 5000k \
        -c:a aac -b:a 128k -ar 48000 -ac 2 -f flv "$cloudflare" || true
      sleep 2
    done
  ) &
  workers[$path]="$!"; sessions[$path]="${session_id}_${generation}"
}

while true; do
  paths_json="$(curl --fail --silent --show-error http://127.0.0.1:9997/v3/paths/list 2>/dev/null || printf '{"items":[]}')"
  mapfile -t active_paths < <(printf '%s' "$paths_json" | jq -r '.items[]?.name | select(startswith("ingest_"))')
  declare -A active=()
  for path in "${active_paths[@]}"; do
    active[$path]=1
    pid="${workers[$path]:-}"
    if [[ -z "$pid" || ! -d "/proc/$pid" ]]; then stop_worker "$path"; start_worker "$path"; fi
  done
  for path in "${!workers[@]}"; do [[ -n "${active[$path]:-}" ]] || stop_worker "$path"; done
  sleep 3
done
