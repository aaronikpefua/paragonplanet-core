# Phase 2 Readiness

| Gate | Status |
|---|---|
| Enough evidence to begin Live/realtime migration? | NO |
| Understand current Live polling cost? | PARTIAL: source constants, projections, and repeated request observations exist; exact timed runtime counts still needed |
| Understand Live first-frame behavior? | PARTIAL: one production WHEP viewer sample measured 15.280s to first playing frame; more samples and Android/HLS coverage needed |
| Distinguish HLS vs WHEP startup? | PARTIAL: measured sample was WHEP; HLS path and WHEP sub-stages remain incomplete |
| Detect unexpected player recreation? | PARTIAL: no recreation was proven in the measured production viewer sample; dedicated lifecycle capture still needed |
| Detect buffering duration? | PARTIAL: slow startup to first frame was measured; full buffer start/end aggregation remains incomplete |
| Identify 429/5xx pressure? | PARTIAL: instrumentation exists and no screenshot-proven 429/5xx was captured; route-level runtime logs still needed |
| Quantify Firestore amplification? | PARTIAL: application-level operation logs exist; billed reads are not exact |
| Keep private-call/RealtimeKit separate? | YES |
| Wallet/vote/escrow authority intact? | YES |

## Recommendation

Do not begin Phase 2 yet. Continue Phase 1 targeted measurement, especially Feed/Explore performance, Android player lifecycle, timed Live polling counts, and WHEP/HLS sub-stage evidence.
