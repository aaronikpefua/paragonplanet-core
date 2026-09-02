# Upload Pipeline Investigation

## Current web Citizen upload flow

1. `Upload.jsx` validates auth, Citizen access, file type, file size, and duration.
2. Browser requests `POST /generate-upload-url` through `appCheckFetch`.
3. Backend `requestUploadUrl` creates an R2 signed upload URL and creates a Firestore `videos/{videoId}` record using Admin SDK.
4. Browser uploads media bytes directly to the signed R2 URL.
5. Browser previously attempted a direct Firestore `setDoc` to `videos/{videoId}`.
6. Browser calls `POST /trigger-compression`.
7. Backend finds the upload record, queues processing, and later writes processed `thumbnailUrl`, `mobileUrl`, `desktopUrl`, `streamUrl`, `status`, and `processingStatus`.
8. Home feed receives `videos` via Firestore listener in `useVideos`.
9. `Explore.jsx` renders title/category/description with fallbacks only when missing.

## Upload timing instrumentation

Added web upload timing events:

- `upload.web.T0_upload_submit`
- `upload.web.T1_upload_url_ready`
- `upload.web.T2_media_upload_complete`
- `upload.web.T3_metadata_save_start`
- `upload.web.T4_metadata_save_complete`
- `upload.web.T5_feed_record_created`

The current app has no specific upload-to-home rendered marker yet for `T6_feed_api_visible`, `T7_home_feed_received`, `T8_home_post_rendered`, or `T9_media_playable`; these remain post-fix manual/instrumented observations unless a later instrumentation pass is approved.

## Media bytes

The browser uploads video bytes directly to R2 using the signed URL. The application server coordinates upload authorization and metadata; it does not relay the uploaded media bytes.

## Production reproduction evidence

Date: 2026-08-31.

Production URL: `https://paragonplanet.com/upload`.

Entered values:

- Talent category: `Dancer`
- Title: `AT`
- Description: `About at`

Observed:

- Media upload progress completed.
- UI reached `Saving video details...`.
- Production then displayed `Missing or insufficient permissions.`
- Home/feed later displayed fallback metadata: title `Untitled`, category `general`.

Interpretation:

- Media upload succeeded before metadata save failure.
- Production is still running the old browser direct-write path because Optimization Cycle 1 source changes have not been deployed.
- This evidence confirms the original root cause remains present in production, not that the local fix failed.
