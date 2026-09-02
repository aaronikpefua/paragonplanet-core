# Upload Optimization

## Fixes implemented

### Metadata preservation

`Upload.jsx` now sends title, description, and category to the backend upload-url request. The backend already supported these fields and persists them to `videos`.

### Permission failure avoidance

Removed the direct browser `setDoc(videoRef, videoData, { merge: true })` write to `videos`.

This avoids the observed runtime failure at the client-side metadata write boundary and keeps video-record writes on the authenticated backend/Admin SDK path that already creates the upload record.

Exact failing operation in production source before this local fix:

- Frontend file/function: `frontend/src/pages/Upload.jsx`, `handleUpload`.
- UI state immediately before failure: `Saving video details...`.
- Operation type: direct Firestore browser `setDoc(videoRef, videoData, { merge: true })`.
- Collection/document: `videos/{clientDerivedVideoId}`.
- Document id source: derived from the R2 object filename timestamp prefix, not the backend returned `video.videoId`.
- Rule involved: `backend/firestore.rules` `match /videos/{videoId}` create/update rules.
- Rejection: Firestore client write was rejected by deployed rules/user context; the direct client write is unnecessary because the backend already writes the canonical upload record with Admin SDK.

### Correct video id usage

The frontend now uses `data.video?.videoId` returned by the backend instead of deriving a document id from the R2 object filename. Compression is triggered with that backend `videoId`.

## Security impact

- Firestore rules were not weakened.
- No wildcard rule was added.
- No public write access was added.
- Auth and App Check request paths are unchanged.
- Browser no longer needs direct write permission for upload metadata on `videos`.

## Deployment requirement

This fix is currently local source only. Production will continue showing the reproduced behavior until the frontend source is built and deployed through the existing web deployment workflow. Backend upload metadata support already exists in source, so this specific upload fix does not require a backend source change unless production backend is older than the inspected controller.

## Risks

- Backend creates the video record at upload URL time, before media bytes finish uploading; this was already the backend behavior and was not redesigned in this patch.
- If R2 upload fails after upload URL creation, a queued/processing record may still exist. This pre-existing lifecycle concern should be measured during `UPLOAD-WEB-POST-001`.
- `T6` through `T9` require manual observation or follow-up instrumentation because Home feed render/playable timing is separate from the upload page.

## Visibility follow-up fix

After production confirmed metadata correctness but measured up to approximately 60 seconds before Home visibility, a bounded one-item recent-upload handoff was added locally.

Files changed:

- `frontend/src/pages/Upload.jsx`
- `frontend/src/hooks/useVideos.js`
- `frontend/src/components/Explore.jsx`
- `frontend/src/components/VideoPlayer.jsx`

Behavior:

- Store one recent Home upload after R2 media upload completes.
- Merge that one item into Home while waiting for the Firestore listener to deliver it.
- Avoid duplicates when Firestore catches up.
- Keep media playback readiness separate from post visibility.

Instrumentation:

- `upload.web.T6_feed_api_visible`
- `upload.web.T7_home_feed_received`
- `upload.web.T8_home_post_rendered`
- `upload.web.T9_media_playable`

Validation:

- Frontend build passed in 12.57s.

## Rollback

Rollback by restoring the previous direct Firestore metadata write block in `Upload.jsx`, removing metadata fields from the upload-url request, and removing `videoId` from the compression trigger body. Firestore rules do not need rollback because they were not changed.

For the visibility follow-up only, remove the recent-upload `sessionStorage` write from `Upload.jsx`, the recent-upload merge helpers from `useVideos.js`, and the upload render/playable markers from `Explore.jsx` and `VideoPlayer.jsx`.
