# Paragon Planet Separate Native Apps Plan

## Direction
Paragon Planet now follows a three-surface product model:
- `frontend/`: website and public web experience
- `android-native/`: real Android app
- `ios-native/`: real iPhone app

The old `android-twa/` project is no longer the strategic mobile path. It remains useful only as historical reference for package/signing/billing experiments.

## Product Principle
We are no longer trying to make the browser feel like a native app.
We are building native mobile apps that talk to the same backend and preserve the same product model.

## Shared Business Surface
The following product concepts remain shared across web, Android, and iPhone:
- authentication and account identity
- roles and onboarding
- video feed and watch experience
- profile and follow graph
- upload flow
- wallet and transaction history
- marketplace and inbox flows
- meet-up / session flows
- admin tools where mobile access is needed

## Current Web Route Inventory
Main routes in the current website include:
- `/` explore feed
- `/watch/:id`
- `/autoplay`
- `/home`
- `/marketplace`
- `/login`
- `/signup`
- `/invite/:code`
- `/inbox`
- `/buyer-inbox`
- `/following`
- `/member/:uid`
- `/meet-up`
- `/meet-up/:uid`
- `/meet-up-session/:requestId`
- `/roles`
- `/onboarding/*`
- `/upload`
- `/profile`
- `/wallet`
- `/admin`

These routes should not be copied literally into mobile. They should be grouped into native feature modules.

## Native Feature Modules

### Core modules for Android and iPhone
1. Auth
- sign in
- sign up
- invite handling
- session persistence

2. Feed
- explore feed
- category filtering
- watch handoff
- autoplay / vertical watch mode

3. Profile
- own profile
- member profile
- follow/following
- role display

4. Upload
- create post/video
- media picker
- upload progress
- moderation state

5. Wallet
- balances
- transaction history
- deposit options
- native Google Play Billing on Android
- native App Store purchase flow on iPhone later if needed

6. Marketplace / Inbox
- shared inbox
- buyer inbox
- merchant marketplace

7. Meet-up
- directory
- request flow
- active session view

8. Onboarding
- citizen
- promoter
- merchant
- backer
- supernal
- sponsor / investor

## Architecture Recommendation

### Website
- keep current `frontend/` app as the website
- continue web-first content publishing and public discovery here

### Android app
- native Android app under `android-native/`
- Kotlin first
- Jetpack Compose recommended for new UI
- Google Play Billing native from the start in wallet module
- ExoPlayer / Media3 for video playback

### iPhone app
- native iOS app under `ios-native/`
- Swift + SwiftUI recommended
- AVPlayer for video playback
- StoreKit only if iOS in-app purchase becomes necessary

## Backend Strategy
The backend remains shared.
Native apps should reuse the same backend concepts but not assume website page flows.

Needed backend-facing capabilities:
- auth/session endpoints or Firebase auth integration contract
- feed query contract
- video detail contract
- profile query/update contract
- follow graph contract
- upload contract
- wallet balance/ledger contract
- billing verification contract
- inbox contract
- meetup contract

## Migration Order

### Phase 1: Foundation
Android:
- create native Android project scaffold
- app theme
- navigation shell
- auth/session base
- API client base

iPhone:
- create iOS project scaffold
- app theme
- navigation shell
- auth/session base
- API client base

### Phase 2: MVP product path
Implement first on both mobile apps:
1. auth
2. feed
3. watch
4. profile
5. wallet foundation

### Phase 3: Creation and social depth
1. upload
2. following
3. inbox
4. marketplace
5. onboarding flows

### Phase 4: Advanced flows
1. meet-up flows
2. admin-support flows where appropriate
3. notifications
4. analytics/crash reporting

## Immediate Repo Move
We should treat the next implementation work as:
- `android-native/`: new real Android app track
- `ios-native/`: new real iPhone app track
- `frontend/`: unchanged website app

## Immediate Build Goal
First real deliverable should be:
1. Android native app shell
2. sign-in state handling
3. real feed screen
4. real watch screen
5. wallet foundation with native Android billing

The iPhone app should start once the Android feature contracts are stable enough to mirror cleanly.

## Decision Summary
If the goal is a standard app experience with no browser chrome and predictable billing, the fix belongs in separate native mobile apps, not in further TWA tuning.
