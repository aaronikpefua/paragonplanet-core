# Paragon Planet Native Android Migration Plan

## Goal
Replace the current Trusted Web Activity wrapper with a fully native Android app under the existing package `com.app.natureswayproduction`, keeping Play signing continuity while removing Chrome browser chrome and moving wallet billing to native Android.

## Why we are switching
The TWA path has now been tested through multiple production releases and still shows browser chrome in the Play-installed app. The latest diagnostics proved Chrome is taking the TWA launch path, but the session is still not being treated as the fully trusted fullscreen experience we need. The remaining behavior is outside the level of control we want for a production app.

## Migration approach
We will not rewrite everything at once. We will migrate in phases so we can ship a stable Android app sooner and keep risk controlled.

### Phase 0: Freeze TWA experiments
- Stop shipping more TWA trust experiments unless needed for rollback safety.
- Keep the current Android package name, signing key, and Play listing.
- Treat the current website as the reference product behavior while we rebuild Android natively.

### Phase 1: Native Android foundation
Build a native Android shell that becomes the permanent app container.

Deliverables:
- `MainActivity` as the real launcher activity
- Material app theme without transparent TWA splash behavior
- Single-activity app with fragments or Compose navigation
- Firebase auth session support on Android
- Common app services:
  - network client
  - auth/session store
  - image loading
  - crash/error logging
  - analytics hooks

Recommended stack:
- Kotlin
- Jetpack Compose
- Navigation Compose
- ViewModel + StateFlow
- Retrofit/OkHttp
- Coil
- Firebase Android SDK
- Google Play Billing Library

### Phase 2: Core native MVP
Rebuild the screens that matter most for app quality and monetization.

Order:
1. Splash / bootstrap
2. Sign in / sign up
3. Home feed
4. Watch / autoplay experience
5. Profile
6. Upload
7. Wallet with native Google Play Billing

Definition of done for MVP:
- no Chrome/TWA top bar
- full native fullscreen app shell
- login works natively
- feed/video watch works natively
- wallet purchase flow is native and Play-compliant

### Phase 3: Native wallet and billing
This is the highest-priority business feature after fullscreen stability.

Replace web billing with:
- native product query
- native purchase launch
- native purchase acknowledgement
- backend verification call to existing server endpoint
- native wallet refresh after verified purchase

Current product mapping:
- `parag_5`
- `gbazilo_1`
- `gbazilo_2`
- `gbazilo_5`
- `gbazilo_10`

Backend integration to preserve:
- existing wallet verification endpoint behavior
- existing wallet balance display logic
- existing deposit fallback if needed during transition

### Phase 4: Remaining feature migration
Migrate secondary web flows one module at a time.

Next candidates:
- inbox / shared inbox
- following
- member profile
- meetup directory / session
- onboarding flows
- merchant marketplace
- admin tools (if Android access is still needed)

## Screen mapping from current web app

### Public / feed
- `/` -> native Explore/Feed screen
- `/watch/:id` -> native video watch detail
- `/autoplay` -> native autoplay feed mode
- `/home` -> native home tab / category feed
- `/about`, `/privacy-policy`, `/users-about`, `/sponsors-investors` -> native info screens or embedded lightweight web views

### Auth
- `/login` -> native login screen
- `/signup` -> native signup screen
- `/invite/:code` -> native invite landing/accept flow

### User core
- `/profile` -> native profile screen
- `/upload` -> native upload flow
- `/wallet` -> native wallet + billing
- `/following` -> native following screen
- `/member/:uid` -> native member profile

### Community / directories
- `/meet-up` -> native meetup directory
- `/meet-up/:uid` -> native meetup request screen
- `/meet-up-session/:requestId` -> native meetup session screen
- `/marketplace` -> native marketplace screen
- `/hero-workers`, `/service-providers`, `/promote-talents` -> native directory screens

### Onboarding
- `/roles`
- `/onboarding/citizen`
- `/onboarding/promoter`
- `/onboarding/merchant`
- `/onboarding/user`
- `/onboarding/backer`
- `/onboarding/supernal`
- `/onboarding/sponsor-investor`

These can be phased in after MVP if needed.

## Recommended implementation order

### Milestone 1: Native shell + auth + home
- create native launcher
- create app navigation tabs
- create login/signup flow
- create home feed shell
- create profile entry

### Milestone 2: Native watch experience
- vertical short-video feed
- video preload strategy
- comments / likes / follow hooks
- bottom nav parity

### Milestone 3: Native wallet
- native billing integration
- backend purchase verification
- transaction history screen
- Paystack fallback decision

### Milestone 4: Upload and profile tools
- media picker
- upload API integration
- profile editing

## Data / backend reuse
We should reuse the existing backend and Firebase model where possible instead of rewriting the server side.

Likely keep:
- Firebase authentication
- Firestore reads/writes where already working
- existing cloud/backend endpoints under `API_URL`
- wallet verification endpoints
- directory/profile data structures

## Android project changes needed

### Replace launcher model
Current project still centers around:
- `LauncherActivity` extending `com.google.androidbrowserhelper.trusted.LauncherActivity`

Migration target:
- `MainActivity` extending `ComponentActivity` or `AppCompatActivity`
- remove TWA-specific metadata and intent filters once native shell is fully in place

### Dependencies to add
- Compose BOM
- Activity Compose
- Navigation Compose
- Lifecycle ViewModel Compose
- Retrofit/OkHttp/Moshi or Kotlinx serialization
- Firebase Auth / Firestore Android SDK if not already added
- Play Billing KTX / billing client
- Coil

### Dependencies to remove later
- `com.google.androidbrowserhelper:androidbrowserhelper`
- `com.google.androidbrowserhelper:billing`
- TWA-specific manifest metadata

## Risk controls
- Keep package name unchanged
- Keep keystore/signing unchanged
- Build internal testing track first
- Migrate wallet in a testable slice before broader feature rewrite
- Avoid full backend rewrites during Android migration

## Proposed first delivery target
A stable internal Android build with:
- native splash
- native login
- native home scaffold
- native bottom navigation
- placeholder native wallet screen
- native billing wiring scaffold

## Immediate next coding task
Start Phase 1 foundation in the Android project:
1. add Kotlin/Compose support
2. add native `MainActivity`
3. change launcher from TWA to native
4. add app navigation scaffold
5. create placeholder screens: Feed, Watch, Wallet, Profile, Upload
6. keep billing implementation for the next slice
