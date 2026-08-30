# Live Measurements

## Tests

| Test | Result | Reason |
|---|---|---|
| L1 Web broadcaster → Web viewer | NOT YET MEASURABLE | no interactive browser pair/session was available in this terminal run |
| L2 Web broadcaster → Android viewer | NOT YET MEASURABLE | no Android device listed by `adb devices` |
| L3 Android broadcaster → Web viewer | NOT YET MEASURABLE | no Android device and no browser session |
| L4 Android broadcaster → Android viewer | NOT YET MEASURABLE | no Android devices connected |
| Live repeat test | NOT YET MEASURABLE | no executable Live direction available |

## Required Metrics

`sessionCreateMs`, `publisherConnectMs`, `goLiveToActiveMs`, `viewerMetadataMs`, `playerReadyMs`, `firstFrameMs`, `totalViewerStartupMs`, `bufferCount`, `bufferDurationMs`, `playerCreateCount`, `playerReleaseCount`, `reconnectAttempts`, `reconnectFailures`, `429Count`, and `5xxCount` are all NOT YET MEASURABLE for manual Live sessions.

## What Is Ready To Measure

Phase 1 instrumentation can emit backend `api.request`, `firestore.operation`, `firestore.transaction`, Cloudflare `upstream.request`, web `ParagonLiveTiming`, web `ParagonPerf`, and Android `ParagonPerf` events during a real run.
