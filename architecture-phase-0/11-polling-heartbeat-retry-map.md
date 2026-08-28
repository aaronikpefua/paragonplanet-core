# Polling, Heartbeat, and Retry Map

| Area | File | Mechanism | Interval/Timing | Request/Action | Scale Direction |
|---|---|---|---|---|---|
| Web Live directory | `ParagonLive.jsx` | `setInterval` | `LIVE_SESSION_POLL_MS` | `GET /api/live/sessions` | cache/push for hot paths |
| Web Live chat | `ParagonLive.jsx` | `setInterval` | `LIVE_CHAT_POLL_MS = 4000` | `GET /api/live/sessions/:id/chat` | realtime room fanout |
| Web Live heartbeat | `ParagonLive.jsx` | interval | periodic | `POST /api/live/sessions/:id/heartbeat` | keep backend truth; reduce durable writes later |
| Web Live startup | `ParagonLive.jsx` | timeouts/retries | buffering message after short delay; ICE/network timeouts | WHEP/HLS/WHIP setup | measure TTFF first |
| Android Live directory | `ParagonLiveScreen.kt` | coroutine delay loop | `LIVE_NOW_REFRESH_MS`, replay/slow refresh constants | Live session list | cache/push for hot paths |
| Android Live chat | `ParagonLiveScreen.kt` | coroutine polling | about 4 seconds | Live chat API | realtime room fanout |
| Android Live broadcast | `ParagonLiveBroadcaster.kt` | RTMP callbacks/retry | event-driven | RTMPS publish | instrument startup/reconnect |
| Web private calls | `PrivateVideoCall.jsx` | REST refresh/media callbacks | implementation-specific | realtime call APIs | shared signalling later |
| Android private calls | `PrivateVideoCallScreen.kt` | Compose/API refresh | implementation-specific | realtime call APIs | shared signalling later |
| MeetUp web | `RequestMeetUp.jsx` | Firestore `onSnapshot` | listener lifecycle | meetup/request changes | keep or unify later |
| Inbox web | `SharedInbox.jsx` | Firestore reads/listeners/timers | scroll timer + message queries | direct/order messages | indexed queries or realtime rooms |
| Android feed progress | `FeedScreen.kt` | `while(true)` delay | about 250ms | local player progress | acceptable only for active player |
| Web video controls | `VideoPlayer.jsx` | UI timers | short | controls/tap state | local-only |

The most scale-sensitive polling is Live chat/session polling because every active viewer multiplies backend and Firestore reads.
