# Upload Home Visibility

## Delay boundaries

Observed issue: after Citizen upload, the post took noticeable time to appear on Home.

Source-level contributors:

- The backend-created video record was created during upload URL generation, but with missing metadata before this patch.
- The frontend then uploaded bytes to R2.
- The frontend attempted a direct Firestore metadata write after media upload.
- If that direct Firestore write failed with `Missing or insufficient permissions`, the flow stopped before navigation/normal feed verification and before reliable compression queueing.
- Home feed uses a Firestore `onSnapshot` listener over `videos`, ordered by `createdAt`, limited to 40.

The 2026-08-31 production reproduction reached `Saving video details...` after upload progress completed, then failed with `Missing or insufficient permissions`. That places the blocking delay/error after media upload and before normal post-upload navigation/compression completion.

## Current expected visibility after fix

- The backend video record is created with supplied metadata during upload URL generation.
- After media upload completes, the frontend no longer performs the fragile direct Firestore `videos` write.
- The compression trigger uses the backend-created `videoId`.
- Home feed should be able to receive the backend-created record through the existing Firestore listener without waiting for a client metadata write.

## 2026-08-31 post-deploy evidence

Classification: MEASURED / IMPROVED / PARTIAL.

- Permission error was resolved.
- Title/category/description appeared correctly on Home.
- The uploaded post took up to approximately 60 seconds before it appeared.
- The Home post initially could show the Paragon logo/processing visual while media readiness continued.

## Remaining delay boundary

The upload page still waits for media upload completion before navigating to Home. After that point, Home depends on Firestore listener delivery and/or media processing readiness for final playback visuals.

Because the backend-created record already exists and the R2 upload has completed, the minimum safe visible-post state exists before final media processing finishes.

## Local visibility optimization

Implemented a bounded one-item recent-upload handoff:

- `Upload.jsx` stores one recent Home upload in `sessionStorage` only after media upload completes.
- `useVideos.js` merges that one recent upload into Home if Firestore has not delivered the matching record yet.
- Once Firestore includes the same id, the snapshot version wins and no duplicate item is added.
- The handoff expires after 10 minutes.

This does not change feed ranking, Firestore queries, backend APIs, upload media transport, or security rules.

## Classification

- Exact post-fix production upload-to-home elapsed time: MEASURED at up to approximately 60 seconds.
- Source-level delay boundary: MEASURED / SOURCE-CONFIRMED for Firestore/render handoff after upload completion.
