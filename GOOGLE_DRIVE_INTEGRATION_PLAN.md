# Google Drive Integration Plan For Tagged

## Goal

Add Google Drive support to Tagged with two separate workflows:

1. Import from Google Drive
   - Copy images, videos, or selected Drive folders into the backend.
   - Store imported files locally under `server/uploads/media`.
   - Generate local thumbnails.
   - Create normal `media` records that work like current uploads.

2. Link / sync from Google Drive
   - Create `media` records in the database without copying the heavy file locally.
   - Keep album, tag, favourite, author, display name, and metrics relationships in Tagged.
   - Serve the original file through the backend from Google Drive when needed.
   - Mark Drive-backed media clearly in the UI.

The correct architecture should be:

```txt
Frontend -> Tagged Backend -> Google Drive API
```

Do not expose Google OAuth tokens or private Drive URLs directly to the frontend.

---

## Current App Context

Project structure:

```txt
client/  React + Vite
server/  Express + MySQL
```

Relevant backend files:

```txt
server/services/Media.service.js
server/controllers/Media.controller.js
server/routes/api/v1/media.routes.js
server/middlewares/upload.middleware.js
server/utils/media.js
server/models/Media.model.js
server/models/Metrics.model.js
server/services/Album.service.js
```

Relevant frontend files:

```txt
client/src/pages/gallerypage/GalleryPage.jsx
client/src/pages/gallerypage/MediaDetailPage.jsx
client/src/components/media-card/MediaCard.jsx
client/src/pages/metricspage/MetricsPage.jsx
client/src/pages/albumspage/AlbumDetailPage.jsx
client/src/pages/albumspage/AlbumPage.jsx
```

Current `media` records assume local storage:

```sql
filename
size
filepath
thumbpath
mediatype
```

Existing relational features are already compatible with Drive-backed media:

```txt
media_tags
media_albums
is_favourite
displayname
author
```

The main change is to generalize where the media file lives.

---

## Local Google Cloud Setup Already Done

OAuth client type:

```txt
Web application
```

Local frontend origins:

```txt
http://localhost:5173
http://localhost:5174
```

Local backend redirect URI:

```txt
http://localhost:3000/api/v1/google-drive/callback
```

The server `.env` should eventually include:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/google-drive/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive.file
```

Recommended first scope:

```txt
https://www.googleapis.com/auth/drive.file
```

Use `drive.readonly` only if the app must browse arbitrary Drive folders without Google Picker selection. It is more powerful but more sensitive.

---

## Phase 1: Database Changes

### 1.1 Extend `media`

Add storage metadata while preserving existing local media behavior.

```sql
ALTER TABLE media
  ADD COLUMN storage_provider ENUM('local', 'google_drive') NOT NULL DEFAULT 'local',
  ADD COLUMN storage_status ENUM('available', 'missing', 'revoked', 'syncing', 'error') NOT NULL DEFAULT 'available',
  ADD COLUMN sync_mode ENUM('imported', 'linked') NOT NULL DEFAULT 'imported',
  ADD COLUMN source_file_id VARCHAR(255) NULL,
  ADD COLUMN source_folder_id VARCHAR(255) NULL,
  ADD COLUMN source_account_id INT UNSIGNED NULL,
  ADD COLUMN source_mime_type VARCHAR(255) NULL,
  ADD COLUMN source_modified_time DATETIME NULL,
  ADD COLUMN source_checksum VARCHAR(255) NULL,
  ADD COLUMN local_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN remote_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN last_synced_at DATETIME NULL,
  ADD COLUMN sync_error VARCHAR(500) NULL;
```

Recommended meaning:

- `storage_provider = local`: file is stored in `server/uploads/media`.
- `storage_provider = google_drive`: original file lives in Google Drive.
- `sync_mode = imported`: copied into Tagged.
- `sync_mode = linked`: registered in Tagged, but original remains remote.
- `size`: keep as logical/original size for compatibility.
- `local_size`: actual bytes stored locally.
- `remote_size`: bytes reported by Google Drive.

For existing records, backfill:

```sql
UPDATE media
SET
  storage_provider = 'local',
  storage_status = 'available',
  sync_mode = 'imported',
  local_size = size,
  remote_size = 0
WHERE storage_provider = 'local';
```

### 1.2 Create Google Drive Connections Table

```sql
CREATE TABLE google_drive_connections (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    google_account_id VARCHAR(255) NULL,
    google_account_email VARCHAR(255) NULL,
    access_token_encrypted TEXT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    token_expiry DATETIME NULL,
    scopes TEXT NOT NULL,
    status ENUM('connected', 'revoked', 'error') NOT NULL DEFAULT 'connected',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,

    INDEX idx_google_drive_connections_user_id (user_id),

    CONSTRAINT fk_google_drive_connections_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);
```

Tokens should be encrypted before being stored.

### 1.3 Create Google Drive Jobs Table

Use jobs for large imports and folder operations.

```sql
CREATE TABLE google_drive_jobs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    connection_id INT UNSIGNED NOT NULL,
    mode ENUM('import', 'link') NOT NULL,
    status ENUM('queued', 'running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
    total_items INT UNSIGNED NOT NULL DEFAULT 0,
    processed_items INT UNSIGNED NOT NULL DEFAULT 0,
    created_media_count INT UNSIGNED NOT NULL DEFAULT 0,
    failed_items INT UNSIGNED NOT NULL DEFAULT 0,
    metadata JSON NULL,
    error_message VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,

    INDEX idx_google_drive_jobs_user_id (user_id),
    INDEX idx_google_drive_jobs_status (status),

    CONSTRAINT fk_google_drive_jobs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_google_drive_jobs_connection
        FOREIGN KEY (connection_id) REFERENCES google_drive_connections(id)
        ON DELETE CASCADE
);
```

### 1.4 Add Audit Actions

Add to `database.sql`:

```sql
('Connect Google Drive', 'GOOGLE_DRIVE_CONNECT', 'Connect Google Drive account', TRUE),
('Disconnect Google Drive', 'GOOGLE_DRIVE_DISCONNECT', 'Disconnect Google Drive account', TRUE),
('Import from Google Drive', 'GOOGLE_DRIVE_IMPORT', 'Import files from Google Drive', TRUE),
('Link from Google Drive', 'GOOGLE_DRIVE_LINK', 'Link files from Google Drive without local copy', TRUE),
('Google Drive sync error', 'GOOGLE_DRIVE_SYNC_ERROR', 'Google Drive sync/import failed', TRUE)
```

---

## Phase 2: Backend Dependencies

Install inside `server`:

```bash
npm install googleapis archiver
```

Optional:

```bash
npm install mime-types
```

Usage:

- `googleapis`: OAuth and Drive API.
- `archiver`: create ZIPs when importing folders as archives.
- `mime-types`: safer MIME detection.

---

## Phase 3: Backend Files To Add

Add:

```txt
server/models/GoogleDriveConnection.model.js
server/models/GoogleDriveJob.model.js
server/services/GoogleDrive.service.js
server/controllers/GoogleDrive.controller.js
server/routes/api/v1/googleDrive.routes.js
```

Register routes in:

```txt
server/routes/api/v1/index.js
```

```js
const googleDriveRoutes = require("./googleDrive.routes");
router.use("/google-drive", googleDriveRoutes);
```

---

## Phase 4: Google Drive Backend API

Create these routes:

```txt
GET  /api/v1/google-drive/auth
GET  /api/v1/google-drive/callback
GET  /api/v1/google-drive/status
POST /api/v1/google-drive/disconnect

GET  /api/v1/google-drive/files
GET  /api/v1/google-drive/folders/:id/children

POST /api/v1/google-drive/import
POST /api/v1/google-drive/link

GET  /api/v1/google-drive/jobs/:id
POST /api/v1/google-drive/jobs/:id/cancel
```

All routes except callback should use `authenticate`.

### OAuth Requirements

Implement:

```js
getAuthUrl(userId)
handleOAuthCallback(code, state)
getStatus(userId)
disconnect(userId)
```

`state` should securely identify the Tagged user. Use a signed JWT or another tamper-resistant value. Do not trust raw user IDs from the browser.

### Drive Client Helpers

Implement:

```js
getOAuthClient(connection)
getDriveClient(connection)
refreshAccessIfNeeded(connection)
```

Fields to request from Drive:

```txt
id
name
mimeType
size
thumbnailLink
webViewLink
modifiedTime
md5Checksum
parents
```

Supported item types:

```txt
image/*
video/*
application/zip
application/x-zip-compressed
application/vnd.google-apps.folder
```

Ignore Google Docs, Sheets, Slides, PDFs, and unsupported types for this first version.

---

## Phase 5: Rework Media Creation For Reuse

Current upload logic in `Media.service.js` should be split so Google Drive imports can reuse it.

Add internal helpers:

```js
createLocalMediaFromFile(file, payload, userId, sourceMetadata = {})
createLinkedMediaFromDriveFile(driveFile, payload, userId, connectionId)
createMediaRecord(mediaData, tagNames, userId)
```

Goals:

- Local upload still works exactly as before.
- Drive import can download a temp/local file and then call the same local creation path.
- Drive link can create a `media` record without saving the original file locally.
- Tag parsing and tag creation remain centralized.

---

## Phase 6: Import From Google Drive

Endpoint:

```txt
POST /api/v1/google-drive/import
```

Body:

```json
{
  "fileIds": [],
  "folderIds": [],
  "options": {
    "recursive": true,
    "importFoldersAsZip": false,
    "displayname": null,
    "author": null,
    "tag_names": []
  }
}
```

Behavior:

1. Validate connection.
2. Resolve selected files and folders.
3. For folders, recurse if `recursive = true`.
4. Filter supported images/videos.
5. Download each supported file from Drive.
6. Save it under `server/uploads/media`.
7. Generate thumbnail via existing `generateThumbnail`.
8. Create `media` record:

```js
{
  storage_provider: "local",
  sync_mode: "imported",
  storage_status: "available",
  size: driveFile.size,
  local_size: downloadedFile.size,
  remote_size: driveFile.size,
  source_file_id: driveFile.id,
  source_folder_id: sourceFolderId || null,
  source_account_id: connection.id,
  source_mime_type: driveFile.mimeType,
  source_modified_time: driveFile.modifiedTime,
  source_checksum: driveFile.md5Checksum || null
}
```

### Folder As ZIP

The current `media.mediatype` only supports:

```txt
image
video
gif
```

Do not force ZIPs into `media` unless adding a new `archive` media type everywhere.

Recommended first version:

- If `importFoldersAsZip = false`, import supported files inside the folder as normal media.
- If `importFoldersAsZip = true`, create a ZIP as a job artifact and expose it from the job result, but do not show it in gallery as media.

Alternative later:

- Add `archive` to `mediatype`.
- Add archive UI icon and behavior.

---

## Phase 7: Link / Sync From Google Drive

Endpoint:

```txt
POST /api/v1/google-drive/link
```

Body:

```json
{
  "fileIds": [],
  "folderIds": [],
  "options": {
    "recursive": true,
    "displayname": null,
    "author": null,
    "tag_names": []
  }
}
```

Behavior:

1. Validate connection.
2. Resolve selected files and folders.
3. Filter images/videos.
4. Do not download original file.
5. Create `media` records:

```js
{
  storage_provider: "google_drive",
  sync_mode: "linked",
  storage_status: "available",
  filename: driveFile.name,
  size: driveFile.size || 0,
  local_size: 0,
  remote_size: driveFile.size || 0,
  filepath: `/api/v1/media/{id}/content`,
  thumbpath: `/api/v1/media/{id}/thumbnail`,
  source_file_id: driveFile.id,
  source_folder_id: sourceFolderId || null,
  source_account_id: connection.id,
  source_mime_type: driveFile.mimeType,
  source_modified_time: driveFile.modifiedTime,
  source_checksum: driveFile.md5Checksum || null
}
```

Because `id` is not available until after insert, either:

- insert with placeholder paths then update paths, or
- keep `filepath` as internal source marker and have frontend compute URLs from `storage_provider`.

Preferred long-term frontend rule:

```txt
Drive media content URL = /api/v1/media/:id/content
Drive media thumbnail URL = /api/v1/media/:id/thumbnail
```

### Thumbnails

Recommended:

- Generate/cache local thumbnails for Drive media when possible.
- If the file is an image, download only enough or download the image temporarily to create a thumbnail, then delete the temporary original.
- If video thumbnail generation is expensive, use Google Drive thumbnail first or create thumbnail asynchronously.

---

## Phase 8: Serve Media Content Through Backend

Add routes to `media.routes.js`:

```txt
GET /api/v1/media/:id/content
GET /api/v1/media/:id/thumbnail
```

Controller methods:

```js
MediaController.streamContent
MediaController.streamThumbnail
```

Service methods:

```js
MediaService.streamContent(id, req, res, requestUser)
MediaService.streamThumbnail(id, req, res, requestUser)
```

Behavior:

### Local Media

- Validate user can access media.
- Serve file from disk or redirect to existing `/uploads/...`.
- Existing `/uploads` static serving can remain for backward compatibility.

### Google Drive Media

- Validate user can access media.
- Load connection by `source_account_id`.
- Refresh OAuth token if needed.
- Fetch file from Google Drive by `source_file_id`.
- Stream response to browser.

### Video Range Support

For videos, support request header:

```txt
Range: bytes=start-end
```

Return:

```txt
206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes start-end/total
Content-Length: chunkSize
Content-Type: video/mp4
```

Without range support, large Drive videos may not play correctly.

---

## Phase 9: Delete Behavior

Update:

```txt
server/services/Media.service.js
```

For `storage_provider = local`:

- Delete original local media file.
- Delete local thumbnail.
- Delete DB record.

For `storage_provider = google_drive`:

- Delete only DB record and relationships.
- Delete local cached thumbnail if any.
- Never delete the file from Google Drive in this version.

This must apply to both:

```js
delete(id, requestUser)
deleteMany(ids, requestUser)
```

---

## Phase 10: Metrics

Update:

```txt
server/models/Metrics.model.js
server/services/Metrics.service.js
client/src/pages/metricspage/MetricsPage.jsx
```

Add metrics:

```txt
totalLogicalBytes
totalLocalBytes
totalRemoteBytes
localMediaCount
driveMediaCount
importedMediaCount
linkedMediaCount
estimatedSavedBytes
```

Suggested SQL summary:

```sql
SELECT
  COUNT(*) AS total_media,
  COALESCE(SUM(m.is_favourite = 1), 0) AS favorite_media_count,
  COALESCE(SUM(m.size), 0) AS total_logical_bytes,
  COALESCE(SUM(m.local_size), 0) AS total_local_bytes,
  COALESCE(SUM(m.remote_size), 0) AS total_remote_bytes,
  COALESCE(SUM(m.storage_provider = 'local'), 0) AS local_media_count,
  COALESCE(SUM(m.storage_provider = 'google_drive'), 0) AS drive_media_count,
  COALESCE(SUM(m.sync_mode = 'imported'), 0) AS imported_media_count,
  COALESCE(SUM(m.sync_mode = 'linked'), 0) AS linked_media_count
FROM media m
WHERE ...
```

`estimatedSavedBytes`:

```txt
SUM(remote_size - local_size) for google_drive linked media
```

---

## Phase 11: Frontend UX

### 11.1 Upload Modal

In `GalleryPage.jsx`, change the upload modal into three modes:

```txt
Computer
Import from Drive
Sync from Drive
```

Computer mode keeps current upload behavior.

Import from Drive:

- Connect Google Drive if disconnected.
- Select Drive files/folders.
- Options:
  - Include subfolders.
  - Import folder contents as media.
  - Import folder as ZIP artifact.
- Start import.
- Show job progress.

Sync from Drive:

- Connect Google Drive if disconnected.
- Select Drive files/folders.
- Create linked media records.
- Show that originals remain in Drive.

### 11.2 Drive Badge

In `MediaCard.jsx` and list views:

- If `media.storage_provider === "google_drive"`, show a small Drive badge.
- If `storage_status !== "available"`, show status:
  - Missing
  - Revoked
  - Syncing
  - Error

### 11.3 Media Detail

In `MediaDetailPage.jsx`, show:

```txt
Storage: Google Drive
Remote size
Local size
Last synced
Status
```

If revoked:

```txt
Reconnect Google Drive
```

### 11.4 Asset URL Helpers

Create shared frontend helpers:

```js
getMediaContentUrl(media)
getMediaThumbnailUrl(media)
```

Rules:

```js
if (media.storage_provider === "google_drive") {
  return `${API_URL}/media/${media.id}/content`;
}
```

For local media, current behavior can remain initially.

Eventually, all media rendering should use backend content/thumbnail endpoints.

---

## Phase 12: Downloads And ZIPs

Existing frontend ZIP/download logic fetches `filepath` directly.

Change gallery and album downloads to use:

```txt
GET /api/v1/media/:id/content
```

This allows mixed local + Drive selections to download correctly.

Files to inspect:

```txt
client/src/pages/gallerypage/GalleryPage.jsx
client/src/pages/albumspage/AlbumDetailPage.jsx
client/src/pages/albumspage/AlbumPage.jsx
```

---

## Phase 13: Error Handling

Handle these cases:

- Drive not connected.
- OAuth token expired.
- Refresh token invalid.
- Permissions revoked.
- File deleted from Drive.
- File moved or inaccessible.
- Unsupported MIME type.
- Folder empty.
- Folder too large.
- Partial import failure.
- Thumbnail generation failure.
- Video stream failure.

Recommended behavior:

- Continue importing other files if one fails.
- Store per-item failures in `google_drive_jobs.metadata`.
- Mark linked media as:
  - `missing`
  - `revoked`
  - `error`
- Show user-friendly UI state.

---

## Phase 14: Security Requirements

Must follow:

- Never expose `GOOGLE_CLIENT_SECRET` to frontend.
- Never return OAuth access/refresh tokens to frontend.
- Encrypt refresh tokens in database.
- Validate Tagged user ownership before serving any media.
- Do not use public Drive links for private files.
- Do not delete from Google Drive in this version.
- Prefer `drive.file` for the first implementation.

Token encryption:

- Add a small encryption helper using Node `crypto`.
- Use `GOOGLE_TOKEN_ENCRYPTION_KEY`.
- Ensure key length is valid for the chosen algorithm.

---

## Phase 15: Implementation Order

### Milestone 1: Safe Data Foundation

- Add SQL schema changes.
- Backfill existing media with local storage metadata.
- Update `MediaModel` selects/inserts to include new columns.
- Ensure existing upload/gallery/detail/album flows still work.

Acceptance:

- App works as before.
- Existing media remains visible.
- Upload still works.

### Milestone 2: OAuth Connection

- Add Google Drive models/services/controllers/routes.
- Implement auth URL.
- Implement callback.
- Store encrypted tokens.
- Add status/disconnect endpoints.

Acceptance:

- User can connect Google Drive.
- User can disconnect Google Drive.
- No tokens are exposed to frontend.

### Milestone 3: Drive Listing

- Implement file/folder listing.
- Filter supported files.
- Return normalized Drive items.

Acceptance:

- Frontend can display Drive files/folders.
- Unsupported files are skipped or shown disabled.

### Milestone 4: Import From Drive

- Implement Drive download.
- Save imported files locally.
- Generate thumbnails.
- Create normal local `media` records.
- Add tags/author/displayname.
- Add job progress.

Acceptance:

- Imported images and videos appear in gallery.
- Imported media can be tagged, favourited, added to albums, deleted.

### Milestone 5: Link From Drive

- Create DB records without local original file.
- Implement content/thumbnail endpoints.
- Add Drive badge.

Acceptance:

- Linked Drive media appears in gallery.
- Linked Drive image opens in detail.
- Linked Drive video plays.
- Deleting linked media does not delete from Drive.

### Milestone 6: Metrics And Downloads

- Split local vs remote storage metrics.
- Update downloads to use backend content endpoint.

Acceptance:

- Metrics show local storage and Drive-linked storage separately.
- Mixed local/Drive download works.

### Milestone 7: Sync Health

- Add "Sync now" action.
- Check whether Drive files still exist.
- Update `storage_status`.

Acceptance:

- Missing/revoked Drive files are represented in UI.

---

## Manual Test Checklist

Test:

1. Existing local media loads.
2. Existing local upload works.
3. Existing local delete removes local files.
4. Google Drive connects.
5. Google Drive disconnects.
6. Drive files list.
7. Drive folders list.
8. Import one image.
9. Import one video.
10. Import multiple files.
11. Import folder contents.
12. Link one image.
13. Link one video.
14. Linked media appears in gallery.
15. Linked media opens in detail.
16. Linked video supports playback.
17. Linked media can be tagged.
18. Linked media can be added to album.
19. Linked media can be favourited.
20. Linked media deletion only removes Tagged record.
21. Mixed local/Drive ZIP download works.
22. Metrics separate local and Drive sizes.
23. Revoked permissions show a clear UI error.
24. Deleted Drive file marks media as missing.

---

## Final Acceptance Criteria

The feature is complete when:

- Users can connect Google Drive.
- Users can import Drive files as local Tagged media.
- Users can link Drive files without copying originals locally.
- Drive-backed media can use albums, tags, favourites, display names, and authors.
- UI clearly marks Drive-backed media.
- Backend serves private Drive content securely.
- Metrics distinguish local disk usage from remote Drive size.
- Deleting Drive-backed media does not delete the Google Drive file.
- Mixed local and Drive media work in gallery, detail, albums, and downloads.

