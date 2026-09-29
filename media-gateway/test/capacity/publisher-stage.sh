#!/usr/bin/env bash
set -euo pipefail
gateway="${1:?gateway IP}"
count="${2:?publisher count}"
sample="${3:?sample file}"
result="${4:?startup CSV}"
hold="${5:-90}"
mkdir -p "$(dirname "$result")"
printf 'publisher,startup_ms,ready,process_alive\n' >"$result"
pids=()
declare -a started ready_ms
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for i in $(seq 1 "$count"); do
  started[$i]=$(date +%s%N)
  ffmpeg -hide_banner -loglevel warning -re -stream_loop -1 -i "$sample" \
    -c copy -f flv "rtmp://${gateway}:1935/ingest_cap${i}_1" \
    >"/opt/results/pub-${i}.log" 2>&1 &
  pid=$!
  pids+=("$pid")
  ready_ms[$i]=0
  sleep .03
done
deadline=$(( $(date +%s) + 20 ))
while (( $(date +%s) < deadline )); do
  remaining=0
  for i in $(seq 1 "$count"); do
    if (( ready_ms[$i] == 0 )); then
      if curl -fsS "http://${gateway}:9997/v3/paths/get/ingest_cap${i}_1" 2>/dev/null \
        | grep -q '"ready":true'; then
        now=$(date +%s%N)
        ready_ms[$i]=$(( (now-started[$i])/1000000 ))
      else
        remaining=$((remaining+1))
      fi
    fi
  done
  (( remaining == 0 )) && break
  sleep .05
done
for i in $(seq 1 "$count"); do
  alive=0; kill -0 "${pids[$((i-1))]}" 2>/dev/null && alive=1
  ready=0; (( ready_ms[$i] > 0 )) && ready=1
  printf '%d,%d,%d,%d\n' "$i" "${ready_ms[$i]}" "$ready" "$alive" >>"$result"
done
sleep "$hold"
