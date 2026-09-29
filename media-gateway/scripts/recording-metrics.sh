#!/usr/bin/env bash
set -euo pipefail

while true; do
  active="$(pgrep -fc 'ffmpeg .*paragon-recording-job' || true)"
  cpu="$(awk -v RS='' '{u=$2+$4; t=$2+$4+$5; if (t>0) printf "%.2f", (u/t)*100; else print 0}' /proc/stat)"
  memory="$(free | awk '/Mem:/ { if ($2>0) printf "%.2f", (($2-$7)/$2)*100; else print 0 }')"
  max_recordings="${PARAGON_RECORDING_MAX_RECORDINGS:-15}"
  scale_out_recordings="${PARAGON_RECORDING_SCALE_OUT_RECORDINGS:-12}"
  payload="$(jq -nc --arg recordingNodeId "${PARAGON_RECORDING_NODE_ID:?}" --arg region "${PARAGON_RECORDING_REGION:-us-central1}" \
    --argjson activeRecordings "${active:-0}" --argjson cpu "${cpu:-0}" --argjson memory "${memory:-0}" \
    --argjson maxRecordings "$max_recordings" --argjson scaleOutRecordings "$scale_out_recordings" \
    '{recordingNodeId:$recordingNodeId,region:$region,role:"recording",healthy:true,activeRecordings:$activeRecordings,maxRecordings:$maxRecordings,scaleOutRecordings:$scaleOutRecordings,cpu:$cpu,memory:$memory,acceptingNewRecordings:($activeRecordings<$maxRecordings and $cpu<85)}')"
  curl --silent --show-error --max-time 5 -H "Authorization: Bearer ${PARAGON_GATEWAY_SERVER_TOKEN:?}" -H "Content-Type: application/json" \
    --data "$payload" "${PARAGON_BACKEND_URL:?}/internal/live/recording-worker/metrics" >/dev/null || true
  sleep 15
done
