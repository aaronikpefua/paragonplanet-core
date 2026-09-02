# Upload Metadata Consistency

## Field map

| Input | Request payload | Backend field | Firestore field | Feed field | Display fallback |
| --- | --- | --- | --- | --- | --- |
| Title | `title` | `title` | `title` | `video.title` | `Untitled` / `Untitled performance` |
| Description | `description` | `description` | `description`, `about` | `video.description`, `video.about` | empty string |
| Talent category | `category` | `category` | `category`, `genre` | `video.category`, `video.genre` | `general` / `General` |

## Metadata loss boundary

Root cause: the web upload request to `/generate-upload-url` did not include `title`, `description`, or `category`, even though the backend controller already accepted these fields and wrote them into the Firestore video record.

The backend-created record therefore stored empty metadata values. Home feed then correctly fell back to display values such as `Untitled` and `general` because the persisted backend record was missing the supplied fields.

Production reproduction on 2026-08-31 confirmed this boundary with title `AT`, category `Dancer`, and description `About at`: the values were entered in the browser form but did not reach the backend-created Home feed record consumed by `useVideos` and `Explore`.

## Fix

`Upload.jsx` now sends:

- `title: effectiveTitle`
- `description: effectiveDescription`
- `category: effectiveCategory`

to `/generate-upload-url`.

The metadata authority for the upload record is now the authenticated backend/Admin SDK write.

## Why fallbacks rendered

- `Explore.jsx` renders `video.title || video.name || "Untitled"`.
- `Explore.jsx` renders `video.category || video.genre || "general"`.
- Because production backend-created records had empty `title`, `category`, and `genre`, the fallback strings were used.
- The renderer fallback is behaving as written; the bug is upstream metadata persistence, not fallback display logic.
