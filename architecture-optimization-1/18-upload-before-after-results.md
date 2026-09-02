# Upload Before / After Results

## Before

- Windows/web upload could show `Saving video details...` followed by `Missing or insufficient permissions`.
- Uploaded Home feed post could show fallback metadata:
  - Title: `Untitled`
  - Category: `general`
- Description could be absent.
- Exact upload-to-home timing was not measured.

## Production reproduction

Classification: MEASURED.

- URL: `https://paragonplanet.com/upload`.
- Input title: `AT`.
- Input category: `Dancer`.
- Input description: `About at`.
- Media upload progress completed.
- UI reached `Saving video details...`.
- Error shown: `Missing or insufficient permissions.`
- Home feed displayed title `Untitled` and category `general`.
- This confirms production still has the old direct Firestore metadata-write failure and metadata-loss path.

## After source fix

- Production test showed no reported permission error after deployment.
- Title/category/description appeared correctly.
- Remaining issue: Home visibility took up to approximately 60 seconds.
- Local follow-up fix now adds one-item recent-upload Home handoff after media upload completion.

## Measurement classification

| Result | Classification |
| --- | --- |
| Metadata-loss boundary | MEASURED / SOURCE-CONFIRMED |
| Permission failure operation | MEASURED / SOURCE-CONFIRMED |
| Post-fix upload success | PENDING |
| Exact upload-to-home delay | MEASURED / PARTIAL: up to approximately 60 seconds |
| Media playable timing | NOT YET MEASURABLE |
| Local visibility follow-up validation | BUILD PASSED |

## UPLOAD-WEB-POST-001

Use one small Citizen video only. Do not upload repeatedly.
