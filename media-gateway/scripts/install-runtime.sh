#!/usr/bin/env bash
set -euo pipefail

backend_url="${1:?backend URL is required}"
gateway_host="${2:?gateway host is required}"
project_id="${3:-paragonplanet-core}"
gateway_public_ip="${4:?gateway public IP is required}"
install_dir="/opt/paragon-live-gateway"
runtime_dir="/etc/paragon-live-gateway"
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

sudo install -d -m 0755 "$install_dir" "$runtime_dir"
sudo cp -R "$source_dir/." "$install_dir/"

server_token="$(gcloud secrets versions access latest --project "$project_id" --secret LIVE_MEDIA_GATEWAY_SERVER_TOKEN)"
internal_token="$(gcloud secrets versions access latest --project "$project_id" --secret LIVE_MEDIA_GATEWAY_INTERNAL_TOKEN)"
turn_password="$(gcloud secrets versions access latest --project "$project_id" --secret LIVE_MEDIA_GATEWAY_TURN_PASSWORD)"

umask 077
runtime_file="$(mktemp)"
printf 'PARAGON_BACKEND_URL=%s\nPARAGON_GATEWAY_HOST=%s\nPARAGON_GATEWAY_PUBLIC_IP=%s\nPARAGON_GATEWAY_SERVER_TOKEN=%s\nPARAGON_GATEWAY_INTERNAL_TOKEN=%s\nPARAGON_TURN_PASSWORD=%s\n' \
  "$backend_url" "$gateway_host" "$gateway_public_ip" "$server_token" "$internal_token" "$turn_password" >"$runtime_file"
sudo install -m 0600 "$runtime_file" "$runtime_dir/runtime.env"
rm -f "$runtime_file"
unset server_token internal_token turn_password

cd "$install_dir"
sudo docker-compose build --pull
sudo docker-compose up -d

sudo tee /etc/cron.d/paragon-live-gateway-cert-renew >/dev/null <<'EOF'
17 3 * * * root certbot renew --quiet --deploy-hook 'cd /opt/paragon-live-gateway && docker-compose restart mediamtx'
EOF
sudo chmod 0644 /etc/cron.d/paragon-live-gateway-cert-renew
