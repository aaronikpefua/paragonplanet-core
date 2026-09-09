#!/usr/bin/env bash
set -euo pipefail

path_value="${MTX_PATH:?MTX_PATH is required}"
path_tail="${path_value#ingest_}"
path_tail="${path_tail#live_}"
media_generation="${path_tail##*_}"
session_id="${path_tail%_*}"

if [[ ! "$session_id" =~ ^[A-Za-z0-9_-]{8,128}$ ]] || [[ ! "$media_generation" =~ ^[1-9][0-9]*$ ]]; then
  exit 2
fi

export PARAGON_SESSION_ID="$session_id"
export PARAGON_MEDIA_GENERATION="$media_generation"

