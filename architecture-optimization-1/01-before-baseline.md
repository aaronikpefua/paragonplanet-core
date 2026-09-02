# Before Baseline

## Phase 1 evidence preserved

### Web feed navigation

- Classification: MEASURED / PARTIAL.
- Test: F4 — Web video navigation.
- Environment: `http://localhost:5173/`.
- Run ID: `FEED-WEB-NAV-001`.
- Manual result: 13 of 13 feed videos eventually opened and played.
- Observed gap: every video navigation showed approximately 2–3 seconds of black screen before video appeared.
- Instrumentation events observed repeatedly: `feed.player.waiting`, `feed.player.ready`, `feed.video.first_frame_ms`.
- No permanent playback failure or major long stall after playback started.

### Android feed comparison

- F2 and F3 showed Android feed videos loading/playing normally.
- F3: 13 of 13 Android feed videos played with no black screens and no major stalls.
- Android feed is not the first optimization target.

