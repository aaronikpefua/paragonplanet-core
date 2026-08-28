# Domain Map

| Domain | Backend Owners | Web Owners | Android Owners | Primary Data |
|---|---|---|---|---|
| Identity/Auth | `auth.routes.js`, `auth.middleware.js`, `nativeXAuth.routes.js` | `AuthContext.jsx`, auth pages | `AuthViewModel.kt`, `AuthScreen.kt`, `SessionRepository.kt`, PPIF | Firebase Auth, `native_x_oauth_sessions`, profiles |
| Profile/Social | profile reads/helpers | `Profile.jsx`, `MemberProfile.jsx`, directories | `ProfileScreen.kt`, `ProfileRepository.kt`, onboarding | `public_profiles`, role profiles, follows |
| Feed/Explore | `video.controller.js`, video services | `Explore.jsx`, `VideoGrid.jsx`, `VideoPlayer.jsx`, `useVideos.js` | `FeedScreen.kt`, `FeedRepository.kt`, `HomeFeedPlaybackController.kt` | `videos`, comments, supports |
| Media | `video.service.js`, `video.processor.js`, `video.queue.js` | `Upload.jsx`, media components | `UploadRepository.kt`, `UploadScreen.kt` | R2 objects, video/product metadata |
| Live | `live.controller.js`, `cloudflareStreamLive.js`, `live.routes.js` | `ParagonLive.jsx` | `ParagonLiveScreen.kt`, `ParagonLiveBroadcaster.kt` | `live_sessions`, chat, `live_supports` |
| Realtime Calls | `realtime.controller.js`, `cloudflareRealtime.js`, `callPlans.js` | `PrivateVideoCall.jsx` | `PrivateVideoCallScreen.kt` | `realtime_call_sessions`, history, plans |
| MeetUp | client-heavy session flows | `RequestMeetUp.jsx`, `MeetUpDirectory.jsx`, `MeetUpSession.jsx` | `MeetUpScreen.kt`, repository/viewmodel | meetup/session data |
| Wallet/Finance | wallet, deposit, bank, billing, support controllers | `Wallet.jsx`, support actions | `WalletScreen.kt`, billing/support calls | wallets, ledger, deposits, withdrawals |
| Marketplace | marketplace controller/services/routes | marketplace pages, inbox | marketplace API/screens | orders, escrow, notifications, audit |
| Notifications/Inbox | marketplace notifications, message data | `SharedInbox.jsx`, `BuyerInbox.jsx` | related screens/APIs | direct/order messages |
| Admin | admin middleware/routes/scripts | admin pages | `AdminScreen.kt` | admin/audit collections |

## Future Logical Boundaries

Evidence supports logical domains first: Identity, Profile/Social, Feed, Media, Live, Realtime/Calls, MeetUp, Wallet/Finance, Marketplace/Commerce, Notifications, and Admin. A modular-monolith split is safer before any microservice split.
