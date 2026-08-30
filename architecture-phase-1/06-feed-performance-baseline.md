# Feed Performance Baseline

## Instrumented

- Web feed Firestore listener snapshots for `public_profiles` and `videos`.
- Web video player creation, source assignment, manifest readiness, metadata, canplay, first playback, waiting, error, and release.
- Android central API timing for feed requests.

## Web Feed Cold Load F1

Classification: MEASURED for successful execution and observed event sequence; NOT YET MEASURABLE for numeric timing values not provided in the captured evidence.

Environment: `http://localhost:5173/`.

Run ID: `FEED-WEB-001`.

Observed result:

- MEASURED: home/feed loaded successfully.
- MEASURED: first feed video became visible and usable/playing.
- MEASURED: this was not a permanent stall or failure.
- MEASURED: `[ParagonPerf]` instrumentation was active with `perfRunId=FEED-WEB-001`.
- MEASURED: observed event families included `feed.player.create`, `feed.player.waiting`, `feed.snapshot`, `feed.player.metadata`, `feed.player.ready`, and `feed.video.first_frame_ms`.
- MEASURED: continued playback showed repeated `feed.player.waiting` → `feed.player.ready` → `feed.video.first_frame_ms` event sequences.

## Extractable Timing Fields

Existing web feed instrumentation can legitimately provide these fields when the console entries are copied with expanded object values:

| Event | Timing field | Meaning | Current F1 value |
|---|---|---|---|
| `feed.snapshot` | `durationMs` | Firestore/listener snapshot processing duration from listener setup to first/current snapshot callback | NOT YET MEASURABLE from the provided summary |
| `feed.player.metadata` | `durationMs` | source assignment to loaded metadata | NOT YET MEASURABLE from the provided summary |
| `feed.player.ready` | `durationMs` | source assignment to canplay/ready | NOT YET MEASURABLE from the provided summary |
| `feed.video.first_frame_ms` | `durationMs` | source assignment to playing/first-frame proxy | NOT YET MEASURABLE from the provided summary |
| `feed.player.manifest_ready` | `durationMs` | HLS manifest readiness where HLS is used | NOT OBSERVED in the provided F1 event list |

## Interpretation

- F1 confirms that the web feed can cold-load successfully under the instrumented localhost environment.
- Startup should not be classified as fast, acceptable, or slow yet because no numeric `durationMs` values were provided.
- Repeated `waiting` → `ready` → `first_frame_ms` during continued playback is a measured lifecycle observation and should be investigated through additional feed navigation/player lifecycle tests, but it is not a Phase 1 permission to change player behavior.

## Remaining Feed Gaps

- Numeric F1 cold-load timings require copied/expanded `[ParagonPerf]` entries for `durationMs`.
- Web player create/release counts require full captured event counts.
- Android feed cold-load and Media3 lifecycle remain NOT YET MEASURABLE.
- Android 10-video swipe player churn remains NOT YET MEASURABLE.

## Android Feed Cold Load F2

Classification: MEASURED for visible successful playback; NOT YET MEASURABLE for Logcat/API/player timing values.

Environment: Android app on connected device `TECNO CE8` / Android 10.

Observed result:

- MEASURED: Android home/feed screen loaded.
- MEASURED: first feed video became visible and usable/playing.
- MEASURED: user classified perceived startup as "a bit fast".
- MEASURED: this was not reported as a permanent stall or failure.
- NOT YET MEASURABLE: filtered Logcat did not emit `ParagonPerf`, `ParagonFeedTiming`, or `HomeFeedPlayer` entries during the capture window.
- NOT YET MEASURABLE: feed API duration, player create count, prepare/ready duration, first-frame duration, buffering count/duration, and release count.

Interpretation: F2 confirms Android feed cold-load success in this manual run, but current captured evidence is visual/user-observed rather than numeric instrumentation. The absence of filtered Logcat output is a measurement gap, not a feed performance failure.

## Android 13-Video Swipe F3

Classification: MEASURED for manual playback stability; NOT YET MEASURABLE for numeric player lifecycle timings/counts.

Observed result:

- MEASURED: user swiped normally through 13 Android feed videos.
- MEASURED: all 13 videos played normally.
- MEASURED: no black screen occurred.
- MEASURED: no major stalls occurred.
- NOT YET MEASURABLE: exact first-frame timings, buffer counts/durations, player create/release counts, source-switch counts, and decoder churn because Logcat timing output was not captured.

Interpretation: this F3 sample supports Android feed playback stability during normal swiping across 13 videos. It does not yet quantify Media3 player lifecycle or decoder churn.

## Web Video Navigation F4

Classification: MEASURED/PARTIAL.

Environment: `http://localhost:5173/`.

Run ID: `FEED-WEB-NAV-001`.

Observed result:

- MEASURED: user navigated normally through 13 web feed videos.
- MEASURED: 13/13 videos eventually opened and played.
- MEASURED: every video page showed approximately 2–3 seconds of black-screen startup before video appeared.
- MEASURED: no permanent playback failure occurred.
- MEASURED: no major long stall occurred after playback started.
- MEASURED: `[ParagonPerf]` evidence was active and repeatedly showed `feed.player.waiting`, `feed.player.ready`, and `feed.video.first_frame_ms`.

## F4 Extractable Numeric Timing Status

Existing instrumentation can provide `durationMs` on `feed.player.ready` and `feed.video.first_frame_ms`, but the expanded console object values were not included in the supplied evidence. Therefore:

| Metric | Current F4 status |
|---|---|
| videos navigated | MEASURED: 13 |
| videos successfully played | MEASURED: 13 |
| success rate | DERIVED: 13/13 = 100% for this manual sample |
| black-screen startup | MEASURED observation: approximately 2–3 seconds on each navigation |
| exact `feed.player.ready.durationMs` | NOT YET MEASURABLE from supplied evidence |
| exact `feed.video.first_frame_ms.durationMs` | NOT YET MEASURABLE from supplied evidence |
| repeated `waiting` count | NOT YET MEASURABLE without copied event count |
| player create/release count | NOT YET MEASURABLE without copied event count |

Interpretation: F4 identifies a measured web feed/video startup performance gap: normal navigation succeeds, but each video has a visible 2–3 second black-screen startup before rendering. Phase 1 records this only; no player strategy, preload, prefetch, or architecture change is made.
