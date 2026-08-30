# Polling Scale Projections

These are DERIVED mathematical projections from current source-defined polling behavior, not load-test results.

## Assumptions

- Live chat polling interval: 4 seconds, measured from source.
- Web Live Now directory polling interval: 6 seconds, measured from source.
- Web Upcoming and Following polling interval: 30 seconds, measured from source.
- Web Replays polling interval: 15 seconds, measured from source.
- Host heartbeat interval is periodic and route-limited to 20/min; exact active client interval should be confirmed during manual Phase 1 tests.

## Runtime Observation

- MEASURED: Chrome Network captures showed repeated `sessions?tab=Live%20Now` and `chat` request families during Live viewing.
- MEASURED: an extended capture accumulated approximately 744 requests, and a cleaner capture accumulated approximately 155 requests.
- NOT YET MEASURABLE: exact requests/minute from those screenshots alone because the observation duration was not reliable enough.

## Live Chat Polling

Formula: `requests/sec = viewers / 4`.

| Concurrent Viewers | Requests/sec | Requests/min |
|---:|---:|---:|
| 100 | 25 | 1,500 |
| 1,000 | 250 | 15,000 |
| 10,000 | 2,500 | 150,000 |
| 100,000 | 25,000 | 1,500,000 |
| 250,000 | 62,500 | 3,750,000 |

## Live Now Directory Polling

Formula: `requests/sec = clients / 6`.

| Clients | 6s Poll Req/sec | Requests/min |
|---:|---:|---:|
| 100 | 16.67 | 1,000 |
| 1,000 | 166.67 | 10,000 |
| 10,000 | 1,666.67 | 100,000 |
| 100,000 | 16,666.67 | 1,000,000 |
| 250,000 | 41,666.67 | 2,500,000 |

## Measurement Classification

- Poll interval constants: MEASURED from source.
- Request family repetition: MEASURED from browser Network observation.
- Requests/sec and requests/min: DERIVED projection.
- Firestore billed reads: NOT YET MEASURABLE exactly.
