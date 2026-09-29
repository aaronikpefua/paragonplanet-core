#!/usr/bin/env bash
set -euo pipefail
suffix="${MTX_PATH#ingest_}"
exec ffmpeg -hide_banner -loglevel warning -nostdin -rtsp_transport tcp \
  -i "rtsp://127.0.0.1:8554/${MTX_PATH}" -map 0:v:0 -map 0:a:0? \
  -c:v copy -c:a libopus -application lowdelay -frame_duration 20 -b:a 96k -ar 48000 -ac 2 \
  -f rtsp -rtsp_transport tcp "rtsp://127.0.0.1:8554/live_${suffix}"
