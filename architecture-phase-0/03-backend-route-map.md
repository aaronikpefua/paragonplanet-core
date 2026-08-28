# Backend Route Map

| Domain | Method | Path | Source | Handler | Auth | Limit | Data/External |
|---|---|---|---|---|---|---|---|
| Health | GET | `/health` | `app.js` | inline | no | global | none |
| Upload | POST | `/generate-upload-url` | `app.js` | `generateUploadUrl` | App Check | 20/min custom | Cloudflare R2 |
| Processing | POST | `/trigger-compression` | `app.js` | trigger compression | App Check | global | R2, Firestore |
| Processing | POST | `/trigger-merchant-product-compression` | `app.js` | merchant compression | App Check | global | R2, `merchant_products` |
| Processing | POST | `/internal/video/process-queue` | `app.js` | queue processor | internal | global | jobs, R2 |
| Video | POST | `/api/video/upload` | `video.routes.js` | `uploadVideo` | App Check | global | `videos`, R2 |
| Video | GET | `/api/video/list` | `video.routes.js`, `app.js` | `listVideos` | mixed | global | `videos`, profiles |
| Video Support | POST | `/support/:videoId` | `app.js` | `supportVideo` | Auth/App Check | global | `videos`, `video_supports`, wallets, ledger |
| Profile Support | POST | `/support/superboss/:supernalId` | `app.js` | `supportSuperboss` | Auth/App Check | global | role votes/support, wallets, ledger |
| Profile Support | POST | `/support/backer/:backerId` | `app.js` | `supportBacker` | Auth/App Check | global | role votes/support, wallets, ledger |
| Wallet | POST | `/api/wallet/create` | `wallet.routes.js` | `createUserWallet` | Auth/App Check | route stack | `wallet_accounts` |
| Wallet | POST | `/api/wallet/credit` | `wallet.routes.js` | `creditWallet` | Auth/App Check | route stack | wallets, ledger |
| Wallet | GET | `/api/wallet/balance` | `wallet.routes.js` | `getWalletBalance` | Auth/App Check | route stack | wallets |
| Wallet | POST | `/api/wallet/convert/:direction` | `wallet.routes.js` | `convertCurrency` | Auth/App Check | 10/min custom | wallets, ledger |
| Payments | POST | `/deposit/initialize` | `app.js` | `initializeDeposit` | Auth/App Check | global | Paystack |
| Payments | POST/GET | `/deposit/verify` | `app.js` | `verifyDeposit` | Auth/App Check | global | Paystack, deposits, wallet, ledger |
| Payments | GET | `/bank/list` | `app.js` | `listBanks` | Auth/App Check | global | Paystack |
| Payments | POST | `/bank/resolve` | `app.js` | `resolveBankAccount` | Auth/App Check | global | Paystack |
| Payments | POST | `/withdraw/request` | `app.js` | `requestWithdraw` | Auth/App Check | global | Paystack, withdrawals, wallet |
| Google Play | POST | `/api/google-play-billing/wallet/verify` | `googlePlayBilling.routes.js` | `verifyWalletPurchase` | Auth/App Check | route stack | Google Play, processed payments, wallet, ledger |
| Live | GET | `/api/live/status` | `live.routes.js` | `getLiveStatus` | App Check | 60/min custom | Cloudflare Stream status |
| Live | GET | `/api/live/sessions` | `live.routes.js` | `listLiveSessions` | App Check | 120/min custom | `live_sessions`, follows, profiles |
| Live | POST | `/api/live/sessions/schedule` | `live.routes.js` | `scheduleLiveSession` | Auth | 10/min custom | `live_sessions` |
| Live | POST | `/api/live/sessions/start` | `live.routes.js` | `startLiveSession` | Auth | 5/min custom | Cloudflare Stream Live, `live_sessions` |
| Live | POST | `/api/live/sessions/:sessionId/active` | `live.routes.js` | `markLiveSessionActive` | Auth | 20/min custom | `live_sessions` |
| Live | POST | `/api/live/sessions/:sessionId/heartbeat` | `live.routes.js` | `heartbeatLiveSession` | Auth | 20/min custom | `live_sessions` |
| Live | POST | `/api/live/sessions/:sessionId/end` | `live.routes.js` | `endLiveSession` | Auth | 20/min custom | `live_sessions`, Cloudflare playback |
| Live Chat | GET | `/api/live/sessions/:sessionId/chat` | `live.routes.js` | `listLiveChatMessages` | Auth | 120/min custom | `live_sessions/{id}/chat_messages` |
| Live Chat | POST | `/api/live/sessions/:sessionId/chat` | `live.routes.js` | `postLiveChatMessage` | Auth | 30/min custom | `live_sessions/{id}/chat_messages` |
| Live Support | POST | `/api/live/sessions/:sessionId/support` | `live.routes.js` | `supportLiveSession` | Auth | 30/min custom | `live_sessions`, `live_supports`, wallets, ledger |
| Realtime | GET | `/api/realtime/plans` | `realtime.routes.js` | `getRealtimePlans` | Auth | global | `realtime_call_plans`, Cloudflare Realtime status |
| Realtime | GET | `/api/realtime/calls` | `realtime.routes.js` | `listMyCalls` | Auth | global | `realtime_call_sessions` |
| Realtime | POST | `/api/realtime/calls/request` | `realtime.routes.js` | `requestPrivateCall` | Auth | 10/min custom | wallets, ledger, call sessions |
| Realtime | POST | `/api/realtime/calls/:callId/accept` | `realtime.routes.js` | `acceptCall` | Auth | global | Cloudflare RealtimeKit, call session |
| Realtime | POST | `/api/realtime/calls/:callId/cancel` | `realtime.routes.js` | `cancelCall` | Auth | global | reservation release, wallet, ledger |
| Realtime | POST | `/api/realtime/calls/:callId/decline` | `realtime.routes.js` | `declineCall` | Auth | global | reservation release, wallet, ledger |
| Realtime | POST | `/api/realtime/calls/:callId/join` | `realtime.routes.js` | `joinCall` | Auth | global | participant token |
| Realtime | POST | `/api/realtime/calls/:callId/connected` | `realtime.routes.js` | `markConnected` | Auth | global | final charge, wallet, ledger |
| Realtime | POST | `/api/realtime/calls/:callId/end` | `realtime.routes.js` | `endCall` | Auth | global | call state/history |
| Marketplace | POST | `/api/marketplace/final-offer` | `marketplace.routes.js` | `sendFinalOffer` | Auth | 20/min express | orders/messages/notifications/audit |
| Marketplace | POST | `/api/marketplace/pay` | `marketplace.routes.js` | `fundEscrow` | Auth | 10/min express | wallets, ledger, escrow, orders |
| Marketplace | POST | `/api/marketplace/deliver` | `marketplace.routes.js` | `submitDelivery` | Auth | 20/min express | deliveries, orders |
| Marketplace | POST | `/api/marketplace/confirm` | `marketplace.routes.js` | `confirmDeliveryAndSettle` | Auth | 10/min express | escrow, wallets, ledger |
| Marketplace | POST | `/api/marketplace/cancel` | `marketplace.routes.js` | `cancelOrder` | Auth | 10/min express | orders, escrow/refunds |
| Marketplace | POST | `/api/marketplace/dispute` | `marketplace.routes.js` | `openDispute` | Auth | 5/min express | disputes, orders |
| Marketplace | GET/POST | `/api/marketplace/notifications...` | `marketplace.routes.js` | notification handlers | Auth | 60/min express | notifications |
| Marketplace Admin | multiple | `/api/marketplace/admin/*` | `marketplace.routes.js` | admin handlers | Admin | 20-60/min express | orders, disputes, escrow, audit |
| Auth | GET/POST | `/api/auth/*` | `auth.routes.js` | auth handlers | App Check/trusted | global | Firebase Auth |
| Native X Auth | POST/GET | `/api/native-x-auth/*` | `nativeXAuth.routes.js` | X OAuth handlers | route-specific | 20/min custom | `native_x_oauth_sessions`, X |
