# Polling Projections

These projections use current source-observed intervals. They are ESTIMATED, not load-test results.

## Live Chat

Current chat polling interval: 4 seconds.

Formula: `requests/sec = viewers / 4`.

| Concurrent Viewers | Requests/sec | Requests/min |
|---:|---:|---:|
| 100 | 25 | 1,500 |
| 1,000 | 250 | 15,000 |
| 10,000 | 2,500 | 150,000 |
| 100,000 | 25,000 | 1,500,000 |
| 250,000 | 62,500 | 3,750,000 |

## Live Directory

Current observed examples: 7-second Android Live Now refresh and 15-second conservative/default web-style projection.

| Clients | 7s Requests/sec | 15s Requests/sec |
|---:|---:|---:|
| 100 | 14.29 | 6.67 |
| 1,000 | 142.86 | 66.67 |
| 10,000 | 1,428.57 | 666.67 |
| 100,000 | 14,285.71 | 6,666.67 |
| 250,000 | 35,714.29 | 16,666.67 |

## Classification

- Poll intervals: MEASURED from source in Phase 0/1.
- Requests/sec and requests/min: ESTIMATED projections.
- Actual production request rates: NOT YET MEASURABLE until runtime logs are captured.
