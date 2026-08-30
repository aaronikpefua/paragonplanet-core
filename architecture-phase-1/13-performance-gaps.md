# Performance Gaps

- WHEP/ICE/media-arrival sub-stage attribution is NOT YET MEASURABLE from current screenshots; the measured 15.213s delay occurred before first remote track, but exact HTTP WHEP, ICE, Cloudflare readiness, and RTP arrival boundaries remain unknown.
- A complete clean localhost `LIVE-WW-001` benchmark is NOT YET MEASURABLE because not all required timing fields, chat, heartbeat, polling counts, and end-state were captured.
- Exact Live requests/minute is NOT YET MEASURABLE from screenshots alone because reliable observation duration was not captured.
- F1 web feed numeric timing values are NOT YET MEASURABLE from the provided summary; copied/expanded [ParagonPerf] entries are needed to quantify feed.snapshot, feed.player.metadata, feed.player.rready, and feed.video.ffirst_frame_ms duration values.
- Repeated web feed waiting → ready → ffirst_frame_ms during continued playback is MEASURED lifecycle behavior and may indicate player/source churn or buffering transitions; exact counts and trigger conditions require F4 web video navigation evidence.
- F2 Android feed timing values are NOT YET MEASURABLE because filtered Logcat emitted no ParagonPerf, ParagonFeedTiming, or HomeFeedPlayer entries during the capture window; visual playback success was measured separately.
- F3 Android swipe numeric player lifecycle remains NOT YET MEASURABLE: manual 13-video swipe was stable, but exact first-frame timings, buffer counts, player create/release counts, source switches, and decoder churn were not captured.
- F4 web video navigation measured a repeated approximately 2-3 second black-screen startup on each of 13 navigated videos; exact feed.player.rready.durationMs, feed.video.ffirst_frame_ms.durationMs, waiting counts, and player create/release counts remain NOT YET MEASURABLE without expanded console events.
- Android player lifecycle creation/release counts are partly NOT YET MEASURABLE beyond API timings.
- Exact Firestore billed reads are NOT YET MEASURABLE from application-level wrappers.
- Marketplace settlement latency requires safe development/test marketplace flow.
- W1 wallet numeric latency is NOT YET MEASURABLE from screenshots alone; web and Android wallet pages rendered successfully, but wallet/API duration values were not captured.
- Wallet/support latency requires safe wallet test data and no real-money operations.
- Cloud Run instance behavior and cold starts require deployed runtime logs.





