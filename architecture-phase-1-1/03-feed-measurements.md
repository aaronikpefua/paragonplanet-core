# Feed Measurements

| Test | Result | Reason |
|---|---|---|
| F1 Web Feed cold load | NOT YET MEASURABLE | no interactive browser/frontend session was run |
| F2 Android Feed cold load | NOT YET MEASURABLE | no Android device connected |
| F3 Android 10-video swipe | NOT YET MEASURABLE | no Android device connected |
| F4 Web continuous navigation | NOT YET MEASURABLE | no interactive browser/frontend session was run |

## Instrumentation Ready

- Web `useVideos` can measure `public_profiles` and `videos` listener snapshots.
- Web `VideoPlayer` can measure player/source/manifest/metadata/ready/first playback/waiting/error/release events.
- Android `ParagonApiService` can measure feed API request durations.

No feed runtime measurements were collected in Phase 1.1.
