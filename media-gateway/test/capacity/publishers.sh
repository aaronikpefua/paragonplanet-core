#!/usr/bin/env bash
set -euo pipefail
gateway="${1:?gateway IP}"; count="${2:?count}"; sample="${3:?sample file}"
pids=(); cleanup(){ for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; wait 2>/dev/null || true; }; trap cleanup EXIT INT TERM
for i in $(seq 1 "$count"); do
  ffmpeg -hide_banner -loglevel warning -re -stream_loop -1 -i "$sample" -c copy -f flv "rtmp://${gateway}:1935/ingest_cap${i}_1" >/opt/results/pub-${i}.log 2>&1 & pids+=("$!"); sleep .08
done
wait
