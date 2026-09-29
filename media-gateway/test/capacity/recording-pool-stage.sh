#!/usr/bin/env bash
set -euo pipefail
origin="${1:?origin IP}"
count="${2:?recording count}"
hold="${3:-90}"
result_dir="${4:-/opt/results}"
mkdir -p "$result_dir"
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for i in $(seq 1 "$count"); do
  (
    for _ in $(seq 1 200); do
      if curl -fsS "http://${origin}:9997/v3/paths/get/live_cap${i}_1" 2>/dev/null \
        | grep -q '"ready":true'; then
        exec ffmpeg -hide_banner -loglevel warning -rtsp_transport tcp \
          -i "rtsp://${origin}:8554/live_cap${i}_1" \
          -map 0:v:0 -map 0:a:0? -c:v libx264 -preset veryfast -tune zerolatency \
          -profile:v baseline -level 3.1 -b:v 2500k -maxrate 2500k -bufsize 5000k \
          -g 60 -keyint_min 60 -sc_threshold 0 -bf 0 \
          -c:a aac -b:a 128k -ar 48000 -f null -
      fi
      sleep .1
    done
    exit 1
  ) >"${result_dir}/recording-${i}.log" 2>&1 &
  pids+=("$!")
done
sleep "$hold"
