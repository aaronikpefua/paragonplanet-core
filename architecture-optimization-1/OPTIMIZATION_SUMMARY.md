# Optimization Summary

## Phase 1 checkpoint

- Commit: `3402b3f`
- Message: `chore: checkpoint Phase 1 performance baseline`

## Optimization Cycle 1 status

- Current focus: web feed/video transition black-screen startup.
- Architecture migration performed: no.
- Production behavior changed: no intentional product behavior change.
- Deployment performed: no.

## Implemented change

The active web feed video now receives the existing thumbnail URL and displays it until the first video frame reaches the `playing` lifecycle event. This keeps the transition visually filled while preserving the current player/source behavior.

## Validation

- `frontend` build passed.
- After-change manual feed navigation measurement completed.

## After measurement

- Run ID: `FEED-WEB-NAV-POST-001`.
- Result: 13 of 13 videos played successfully.
- Black-screen transition: reduced compared with Phase 1 baseline, but not completely gone.
- Permanent playback failures: none observed.

## Remaining bottleneck

The next video is still prepared only after activation. The existing next-video `preload` attempt does not usually run because inactive feed cards are thumbnail placeholders, not video elements.

## Proposed follow-up

Add a bounded one-next-video preload/preparation path. This was approved and implemented.

## Bounded preload implementation

- `Explore.jsx` prepares at most one next playable feed source.
- `VideoPlayer.jsx` owns the hidden muted preloader.
- HLS preload is manifest-oriented with `autoStartLoad: false`.
- File preload uses native metadata preload.
- Cleanup logs release and removes/destroys the prepared media source.

## Added instrumentation

- `feed.preload.next.start`
- `feed.preload.next.ready`
- `feed.preload.next.release`
- `feed.preload.next.error`

## Current validation

- Frontend build passed.
- Manual `FEED-WEB-NAV-POST-002` is required before calling the follow-up successful.

## FEED-WEB-NAV-POST-002 result

- Classification: MEASURED / IMPROVED / PARTIAL.
- 13 of 13 videos played successfully.
- Patch 2 reduced the black-screen transition further compared with Patch 1.
- The current feed optimization work should remain in place.

## Citizen upload optimization

### Root causes

- Metadata loss: `Upload.jsx` collected title, description, and category but did not send them to `/generate-upload-url`.
- Fallback display: backend-created `videos` records had empty metadata, so Home feed displayed fallback values such as `Untitled` and `general`.
- Permission failure: the browser attempted a direct Firestore metadata write to `videos` during `Saving video details...`; this write is unnecessary because the backend already creates the upload record with Admin SDK.
- Video id mismatch risk: the browser derived `videoId` from the R2 object filename instead of using `data.video.videoId` returned by the backend.

### Fixes

- Send `title`, `description`, and `category` to the backend upload-url request.
- Use backend returned `videoId`.
- Remove direct browser `setDoc` write to `videos`.
- Send `videoId` to `trigger-compression`.
- Add upload timing instrumentation through `T5`.

### Validation

- Frontend build passed in 13.75s.
- Backend tests passed: 4 test files, 51 tests.

### Next test

Run `UPLOAD-WEB-POST-001` with one small Citizen video to verify metadata, permission behavior, Home visibility timing, and media readiness.

### Production reproduction

On 2026-08-31, production upload reproduced the issue with title `AT`, category `Dancer`, and description `About at`. Upload progress completed, the UI reached `Saving video details...`, then Firestore returned `Missing or insufficient permissions`. Home feed showed fallback title `Untitled` and category `general`.

This confirms production has not received the local upload fix yet. Do not ask for another upload until the local fix is reviewed and deployed.

### Post-deploy upload evidence

After deployment, Citizen upload metadata appeared correctly and the permission problem was no longer reported. The remaining measured problem is Home visibility delay: the post took up to approximately 60 seconds before appearing.

### Upload visibility follow-up

Implemented locally:

- A one-item recent-upload handoff from Upload to Home after media upload completes.
- Home merges that one item while waiting for Firestore listener delivery.
- Snapshot records still replace the handoff item, avoiding duplicates.
- Added `T6` through `T9` visibility/playability instrumentation.

Frontend build passed in 12.57s. This visibility follow-up is not deployed yet.

