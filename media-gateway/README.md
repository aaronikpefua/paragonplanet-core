# Paragon Live Media Gateway

Production origin for the dual-output Live media profile:

`Android/OBS RTMPS or SRT | Web/future iOS WHIP -> MediaMTX -> WHEP viewers + Cloudflare Stream recording`.

MediaMTX performs protocol routing. The bundled FFmpeg hook copies video into the low-latency WebRTC path, normalizes audio to Opus, and sends an H.264/AAC rendition to the existing session-specific Cloudflare Live Input. Backend-issued HMAC tokens are path-, action-, generation-, and expiry-scoped. The gateway's static credentials are runtime secrets and must never be committed.

The host requires a stable public IPv4 address, TLS hostname, TCP 1936/3478/8189/8889, UDP 3478/8189/8890, and the bounded TURN relay range UDP 49160-49200. Port 22 should be restricted to administrative source ranges. The Control API and metrics bind to loopback only.

Future native iOS contract: call the existing session start API with `publisherTransport=whip`, publish to `ingest.webRtcPublishUrl` using `ingest.webRtcPublishToken`, join the existing realtime room, and end through the existing session end API. No iOS-specific backend session type is required.

## On-demand recording pool (launch-disabled)

Recording nodes use `docker-compose.recording.yml` and remain physically separate from MediaMTX origins. Production provisioning is intentionally disabled until launch approval.

Required launch controls:

- `LIVE_RECORDING_AUTOSCALE_ENABLED=false`
- `LIVE_RECORDING_MACHINE_PROFILE=e2-highcpu-4|e2-highcpu-8|e2-highcpu-16`
- `LIVE_RECORDING_MIN_NODES=0`
- `LIVE_RECORDING_MAX_NODES=0`
- `LIVE_RECORDING_IDLE_TIMEOUT_SECONDS=900`
- `LIVE_RECORDING_SCALE_COOLDOWN_SECONDS=600`
- `LIVE_RECORDING_STARTUP_TIMEOUT_SECONDS=300`
- `LIVE_RECORDING_REGIONS=us-central1`
- `LIVE_RECORDING_MONTHLY_BUDGET_USD=0`

The control plane may request capacity only when autoscaling is enabled, a positive maximum node count and approved monthly budget are configured, demand exceeds healthy slots, and cooldown has elapsed. Scale-to-zero requires zero active, assigned, pending, and retrying jobs plus completed drain and idle timeout. A true zero-node pool cannot guarantee recording from the first media frame because VM startup occurs after demand; the API exposes `RECORDING_CAPACITY_PENDING` instead of claiming recording is active.
