# Paragon Live Media Gateway

Production origin for the dual-output Live media profile:

`Android/OBS RTMPS or SRT | Web/future iOS WHIP -> MediaMTX -> WHEP viewers + Cloudflare Stream recording`.

MediaMTX performs protocol routing. The bundled FFmpeg hook copies video into the low-latency WebRTC path, normalizes audio to Opus, and sends an H.264/AAC rendition to the existing session-specific Cloudflare Live Input. Backend-issued HMAC tokens are path-, action-, generation-, and expiry-scoped. The gateway's static credentials are runtime secrets and must never be committed.

The host requires a stable public IPv4 address, TLS hostname, TCP 1936/3478/8189/8889, UDP 3478/8189/8890, and the bounded TURN relay range UDP 49160-49200. Port 22 should be restricted to administrative source ranges. The Control API and metrics bind to loopback only.

Future native iOS contract: call the existing session start API with `publisherTransport=whip`, publish to `ingest.webRtcPublishUrl` using `ingest.webRtcPublishToken`, join the existing realtime room, and end through the existing session end API. No iOS-specific backend session type is required.
