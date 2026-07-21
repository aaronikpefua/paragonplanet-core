# Android Native Track

This directory is reserved for the real native Android application for Paragon Planet.

## Planned stack
- Kotlin
- Jetpack Compose
- Navigation Compose
- Media3 / ExoPlayer
- Google Play Billing
- shared backend/API integration with the website

## First milestones
1. project bootstrap
2. auth/session foundation
3. feed screen
4. watch/player screen
5. wallet foundation with Google Play Billing

## Notes
- This is the strategic replacement for the TWA mobile approach.
- Keep package continuity requirements in mind: `com.app.natureswayproduction`.
- Signing and Play Console continuity from `android-twa/` should be reused when production migration happens.
