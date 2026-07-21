# Mobile API Contract for Paragon Planet

## Base assumptions
- Mobile apps share the existing backend with the website.
- Most protected endpoints currently require:
  - `Authorization: Bearer <Firebase ID token>`
  - `X-Firebase-AppCheck: <token>`
- CORS is configured for the website, but native mobile apps will call the backend directly and should not depend on browser CORS behavior.

## Auth / Session
### GET `/api/auth/me`
Purpose:
- confirm the authenticated user session
- fetch the current identity snapshot

Response:
- `uid: string`
- `email: string | null`
- `role: string | null`

### POST `/api/auth/logout`
Purpose:
- reserved for future token revocation
- current effective logout remains client-side Firebase sign-out

Response:
- `message: string`

## Feed / Watch
### GET `/api/video/list`
Purpose:
- list active videos for the feed

Current backend note:
- current implementation returns an in-memory list, so the mobile apps should treat this as a temporary contract until real persistence is wired.

Expected client model:
- `id`
- `title`
- `category`
- `status`
- creator/performer metadata when available
- media URL / watch binding when available

### POST `/api/video/upload`
Protected.
Purpose:
- request a signed upload URL and create the pending video record

Request body:
- `fileName`
- `fileType`
- optional: `title`, `category`, `uploadPurpose`, `fileSize`, `durationSeconds`

Response:
- `uploadUrl`
- `fileName`
- `fileUrl`
- `video`

### POST `/api/video/trigger-compression`
Protected.
Purpose:
- queue uploaded media for processing

## Wallet
### POST `/api/wallet/create`
Protected.
Purpose:
- initialize a wallet account for the authenticated user

### GET `/api/wallet/balance`
Protected.
Purpose:
- fetch wallet balance

Current response:
- `walletId`
- `balance.PARAG`
- `balance.GBAZILO`

### POST `/api/google-play-billing/wallet/verify`
Protected.
Purpose:
- verify Android Google Play Billing purchase and credit wallet balances

Request body:
- `productId`
- `purchaseToken`

Expected response:
- `ok: boolean`
- `alreadyProcessed: boolean`
- `creditedParag: number`
- `creditedGbazilo: number`

Known product IDs in current Android/web flow:
- `parag_5`
- `gbazilo_1`
- `gbazilo_2`
- `gbazilo_5`
- `gbazilo_10`

## Deposit fallback
### POST `/deposit/initialize`
Protected.
Purpose:
- initialize web deposit/payment flow fallback

### POST or GET `/deposit/verify`
Protected.
Purpose:
- verify deposit result

## Upload
Mobile upload flow should be:
1. authenticate user
2. request signed URL from `/api/video/upload`
3. upload binary directly to storage using the signed URL
4. call compression trigger endpoint
5. poll/refresh feed/profile state

## Native app phase mapping
### Phase 1 Android / iPhone
- Auth/session: `/api/auth/me`
- Feed: `/api/video/list`
- Watch: feed-selected video detail binding from list or future detail endpoint
- Wallet foundation: `/api/wallet/create`, `/api/wallet/balance`
- Android billing: `/api/google-play-billing/wallet/verify`

## Gaps to resolve next
1. formal video detail contract
2. formal profile contract
3. formal follow/following contract
4. formal upload completion state contract
5. formal wallet transaction history endpoint
