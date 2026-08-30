# Firestore Amplification

No runtime Firestore operation log file was captured in Phase 1.1.

| Collection | Operation Data | Classification |
|---|---|---|
| `live_sessions` | instrumentation ready; no runtime data | NOT YET MEASURABLE |
| `chat_messages` | instrumentation ready; no runtime data | NOT YET MEASURABLE |
| `live_supports` | instrumentation ready through support transaction; no runtime data | NOT YET MEASURABLE |
| `videos` | web listener instrumentation ready; no runtime data | NOT YET MEASURABLE |
| `public_profiles` | web/backend instrumentation ready; no runtime data | NOT YET MEASURABLE |
| `wallet_accounts` | transaction route timing ready; no runtime data | NOT YET MEASURABLE |
| `ledger_entries` | transaction route timing ready; no runtime data | NOT YET MEASURABLE |
| `merchant_orders` | route timing ready; no runtime data | NOT YET MEASURABLE |
| `merchant_order_messages` | route timing ready; no runtime data | NOT YET MEASURABLE |
| `meetup_call_sessions` | no Phase 1.1 runtime data | NOT YET MEASURABLE |

Application-level Firestore amplification is measurable once logs exist. Exact billed Firestore reads remain NOT YET MEASURABLE from this instrumentation alone.
