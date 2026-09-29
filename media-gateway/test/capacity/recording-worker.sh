#!/usr/bin/env bash
set -euo pipefail
declare -A workers
stop_one() { local p="$1" pid="${workers[$p]:-}"; [[ -z "$pid" ]] || { kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }; unset 'workers[$p]'; }
cleanup() { for p in "${!workers[@]}"; do stop_one "$p"; done; }
trap cleanup EXIT INT TERM
while true; do
  paths="$(curl -fsS http://127.0.0.1:9997/v3/paths/list 2>/dev/null || printf '{"items":[]}')"
  mapfile -t active < <(printf '%s' "$paths" | jq -r '.items[]?.name|select(startswith("ingest_cap"))')
  declare -A seen=()
  for p in "${active[@]}"; do
    seen[$p]=1; pid="${workers[$p]:-}"
    if [[ -z "$pid" || ! -d "/proc/$pid" ]]; then
      ffmpeg -hide_banner -loglevel warning -nostdin -rtsp_transport tcp -i "rtsp://127.0.0.1:8554/$p" \
        -map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -tune zerolatency -profile:v high -level 4.1 \
        -g 60 -keyint_min 60 -sc_threshold 0 -b:v 2500k -maxrate 2500k -bufsize 5000k \
        -c:a aac -b:a 128k -ar 48000 -ac 2 -f null - >/tmp/recording-${p}.log 2>&1 &
      workers[$p]=$!
    fi
  done
  for p in "${!workers[@]}"; do [[ -n "${seen[$p]:-}" ]] || stop_one "$p"; done
  sleep 2
done
