# Tagged — Backend API

REST API backend for the Tagged media management application. Allows users to upload, organize, tag, and album-sort images, videos, and GIFs with JWT-based authentication.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [API Reference](#api-reference)
  - [System](#system)
  - [Auth](#auth-apiv1auth)
  - [Users](#users-apiv1users)
  - [Media](#media-apiv1media)
  - [Tags](#tags-apiv1tags)
  - [Albums](#albums-apiv1albums)
- [Database Schema](#database-schema)
- [File Storage](#file-storage)
- [Error Handling](#error-handling)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Express.js 4.19 |
| Database | MySQL 2 (`mysql2/promise`) |
| Authentication | JWT (`jsonwebtoken`) |
| Password hashing | bcrypt |
| File uploads | multer |
| Image processing | sharp |
| Video processing | fluent-ffmpeg + ffmpeg-static |
| Dev server | nodemon |

---

## Project Structure

```
server/
├── config/
│   └── database.js           # MySQL connection pool
├── controllers/
│   ├── Auth.controller.js
│   ├── User.controller.js
│   ├── Media.controller.js
│   ├── Tag.controller.js
│   └── Album.controller.js
├── middlewares/
│   ├── auth.middleware.js     # JWT verification + admin check
│   └── upload.middleware.js   # multer config + file validation
├── models/                    # Raw database queries
│   ├── User.model.js
│   ├── Media.model.js
│   ├── Tag.model.js
│   ├── Album.model.js
│   ├── MediaTag.model.js      # media ↔ tag junction
│   ├── MediaAlbum.model.js    # media ↔ album junction
│   └── RefreshToken.model.js
├── services/                  # Business logic
│   ├── Auth.service.js
│   ├── User.service.js
│   ├── Media.service.js
│   ├── Tag.service.js
│   └── Album.service.js
├── routes/
│   ├── index.js               # Root router
│   └── api/v1/
│       ├── index.js           # v1 overview + health check
│       ├── auth.routes.js
│       ├── user.routes.js
│       ├── media.routes.js
│       ├── tag.routes.js
│       └── album.routes.js
├── utils/
│   ├── jwt.js                 # Token generation/verification helpers
│   └── media.js               # MIME detection + thumbnail generation
├── uploads/
│   ├── media/                 # Uploaded files
│   └── thumbnails/            # Auto-generated thumbnails
├── index.js                   # Server entry point
├── package.json
└── .env.example
```

---

## Getting Started

### Prerequisites

- Node.js v14+
- MySQL 5.7+
- FFmpeg (required for video thumbnail generation)
  - On Windows: download from https://ffmpeg.org/download.html and add to PATH
  - On Linux: `sudo apt install ffmpeg`
  - On macOS: `brew install ffmpeg`

### Installation

```bash
cd server
npm install
```

```bash
# Development (auto-reload with nodemon)
npm run dev

# Production
npm start
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
NODE_ENV=development
PORT=3000

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=media_app
DB_USER=appuser
DB_PASSWORD=apppassword
DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_IDLE=10000

# JWT — use long, random base64-encoded secrets
JWT_SECRET=your_access_token_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRES_IN=7d

# CORS — origin of your frontend
CORS_ORIGIN=http://localhost:5173
```

### Database Setup

Create the MySQL database and user, then run the following DDL to create all tables:

```sql
CREATE DATABASE IF NOT EXISTS media_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY 'apppassword';
GRANT ALL PRIVILEGES ON media_app.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;

USE media_app;

CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  type        ENUM('basic','admin','dev') NOT NULL DEFAULT 'basic',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  displayname VARCHAR(255) NOT NULL,
  author      VARCHAR(255),
  filename    VARCHAR(255) NOT NULL,
  size        INT NOT NULL,
  filepath    VARCHAR(500) NOT NULL,
  thumbpath   VARCHAR(500),
  mediatype   ENUM('image','video','gif') NOT NULL,
  is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
  updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  tagname        VARCHAR(100) NOT NULL,
  tagcolor_hex   VARCHAR(7) NOT NULL DEFAULT '#643aff',
  type           ENUM('default','copyright') NOT NULL DEFAULT 'default',
  UNIQUE KEY unique_tag_per_user (user_id, tagname),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE media_tags (
  tagid    INT NOT NULL,
  mediaid  INT NOT NULL,
  PRIMARY KEY (tagid, mediaid),
  FOREIGN KEY (tagid)   REFERENCES tags(id)  ON DELETE CASCADE,
  FOREIGN KEY (mediaid) REFERENCES media(id) ON DELETE CASCADE
);

CREATE TABLE albums (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  albumname       VARCHAR(255) NOT NULL,
  albumcoverpath  VARCHAR(500),
  albumthumbpath  VARCHAR(500),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE media_albums (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  mediaid  INT NOT NULL,
  albumid  INT NOT NULL,
  UNIQUE KEY unique_media_album (mediaid, albumid),
  FOREIGN KEY (mediaid) REFERENCES media(id) ON DELETE CASCADE,
  FOREIGN KEY (albumid) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE refresh_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  token       VARCHAR(512) NOT NULL,
  userid      INT NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Architecture

The backend follows a three-layer architecture:

```
Request → Controller → Service → Model → Database
```

- **Controller** — Parses HTTP request, calls service, returns HTTP response.
- **Service** — Contains all business logic, validation, and orchestration.
- **Model** — Executes raw SQL queries against the database.

### User isolation

All protected endpoints enforce user isolation at the service layer. A user can only access their own resources. Users with `type = 'admin'` bypass this restriction and can access all data.

---

## Authentication

The API uses a dual-token JWT strategy:

| Token | Lifetime | Storage |
|---|---|---|
| Access token | 15 minutes | Client memory / Authorization header |
| Refresh token | 7 days | Database + client storage |

### Flow

1. **Login** (`POST /api/v1/users/login`) — Returns both `accessToken` and `refreshToken`.
2. **Authenticated requests** — Send the access token as `Authorization: Bearer <accessToken>`.
3. **Token refresh** (`POST /api/v1/auth/refresh`) — Send `{ refreshToken }` to receive a new access token.
4. **Logout** (`POST /api/v1/auth/logout`) — Invalidates the refresh token in the database.

Refresh tokens are stored in the database, so they can be revoked at any time. Expired tokens are automatically cleaned up on each refresh attempt.

---

## API Reference

All protected routes require the header:
```
Authorization: Bearer <accessToken>
```

Responses follow the format:
```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

---

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | API info |
| `GET` | `/api/v1` | v1 overview with all available endpoints |
| `GET` | `/api/v1/health` | Health check |

---

### Auth `/api/v1/auth`

#### `POST /refresh`
Get a new access token using a valid refresh token.

**Body:**
```json
{ "refreshToken": "..." }
```

**Response `200`:**
```json
{ "success": true, "accessToken": "..." }
```

---

#### `POST /logout`
Revoke a single refresh token.

**Body:**
```json
{ "refreshToken": "..." }
```

---

#### `POST /logout-all` 🔒
Revoke all refresh tokens for the authenticated user (logs out from all devices).

---

### Users `/api/v1/users`

#### `POST /` — Register
Create a new user account.

**Body:**
```json
{
  "username": "john",
  "email": "john@example.com",
  "password": "secret123"
}
```

Validation:
- `username`: 3–50 characters
- `email`: valid email format
- `password`: minimum 6 characters

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": 1, "username": "john", "email": "john@example.com", "type": "basic" }
}
```

---

#### `POST /login`
Authenticate and receive tokens.

**Body:**
```json
{ "email": "john@example.com", "password": "secret123" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "username": "john", "email": "...", "type": "basic" },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

---

#### `GET /` 🔒
Get all users (admin only).

---

#### `GET /:id` 🔒
Get a user by ID.

---

#### `PUT /:id` 🔒
Update user information.

**Body** (all fields optional):
```json
{
  "username": "newname",
  "email": "new@example.com",
  "password": "newpassword"
}
```

---

#### `DELETE /:id` 🔒
Delete a user account.

---

### Media `/api/v1/media`

#### `GET /` 🔒
List media items for the authenticated user with pagination.

**Query params:**
| Param | Default | Description |
|---|---|---|
| `page` | `1` | Page number |
| `limit` | `20` | Items per page |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "media": [ { "id": 1, "displayname": "...", "mediatype": "image", "tags": [...], ... } ],
    "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
  }
}
```

---

#### `GET /displaynames` 🔒
Get all distinct display names for the authenticated user, sorted A–Z.

---

#### `GET /authors` 🔒
Get all distinct author names for the authenticated user, sorted A–Z.

---

#### `GET /:id` 🔒
Get a single media item by ID (includes its tags).

---

#### `POST /upload` 🔒
Upload a single media file.

**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|---|---|---|
| `file` | Yes | The media file (image or video) |
| `displayname` | Yes | Human-readable name |
| `author` | No | Creator attribution |
| `tag_names` | No | JSON array or comma-separated tag names |

Accepted MIME types: `image/*`, `video/*`
Max file size: **200 MB**

Thumbnails are automatically generated:
- **Images / GIFs** — resized to 640×640, JPEG quality 72 (via sharp)
- **Videos** — frame extracted with FFmpeg, then processed with sharp

If a tag in `tag_names` does not yet exist, it is created automatically.

**Response `201`:**
```json
{
  "success": true,
  "data": { "id": 42, "displayname": "...", "mediatype": "image", "tags": [...], ... }
}
```

---

#### `POST /upload/multiple` 🔒
Upload up to **50 files** at once with the same metadata.

**Content-Type:** `multipart/form-data`

Same fields as single upload. The `files` field accepts multiple files.

---

#### `PUT /:id` 🔒
Update media metadata.

**Body** (all fields optional):
```json
{
  "displayname": "New name",
  "author": "Artist",
  "tag_names": ["tag1", "tag2"]
}
```

Replaces all existing tag associations.

---

#### `PATCH /:id/toggle-favourite` 🔒
Toggle the favourite status of a media item.

**Response `200`:**
```json
{ "success": true, "data": { "is_favourite": true } }
```

---

#### `DELETE /:id` 🔒
Delete a single media item and its associated files from disk.

---

#### `DELETE /` 🔒
Delete multiple media items.

**Body:**
```json
{ "ids": [1, 2, 3] }
```

---

### Tags `/api/v1/tags`

#### `GET /` 🔒
Get all tags for the authenticated user.

---

#### `GET /names` 🔒
Get all distinct tag names, sorted A–Z.

---

#### `GET /:id` 🔒
Get a single tag by ID.

---

#### `POST /` 🔒
Create a new tag.

**Body:**
```json
{
  "tagname": "landscape",
  "tagcolor_hex": "#ff5733",
  "type": "default"
}
```

| Field | Required | Constraints |
|---|---|---|
| `tagname` | Yes | 1–100 characters, unique per user |
| `tagcolor_hex` | No | Valid hex color (e.g. `#ff5733`). Default: `#643aff` |
| `type` | No | `"default"` or `"copyright"`. Default: `"default"` |

---

#### `PUT /:id` 🔒
Update an existing tag.

**Body** (all optional):
```json
{
  "tagname": "new-name",
  "tagcolor_hex": "#aabbcc",
  "type": "copyright"
}
```

---

#### `DELETE /:id` 🔒
Delete a tag (also removes all media associations).

---

### Albums `/api/v1/albums`

#### `GET /` 🔒
Get all albums for the authenticated user (includes media count).

---

#### `POST /` 🔒
Create a new album.

**Body:**
```json
{ "albumname": "Summer 2024" }
```

Max album name length: 255 characters.

---

#### `GET /:id` 🔒
Get a single album by ID.

---

#### `PUT /:id` 🔒
Rename an album.

**Body:**
```json
{ "albumname": "New Name" }
```

---

#### `DELETE /:id` 🔒
Delete an album (does not delete the media inside).

---

#### `POST /:id/cover` 🔒
Set the album cover from an existing media item. Only images are accepted as covers.

**Body:**
```json
{ "media_id": 5 }
```

---

#### `DELETE /:id/cover` 🔒
Remove the album cover.

---

#### `GET /:id/media` 🔒
Get all media items inside an album, in their saved order.

---

#### `POST /:id/media` 🔒
Add a single media item to an album.

**Body:**
```json
{ "media_id": 5 }
```

---

#### `POST /:id/media/batch` 🔒
Add multiple media items to an album at once.

**Body:**
```json
{ "media_ids": [1, 2, 3, 4] }
```

---

#### `DELETE /:id/media/:mediaId` 🔒
Remove a single media item from an album.

---

#### `DELETE /:id/media` 🔒
Remove multiple media items from an album.

**Body:**
```json
{ "media_ids": [1, 2, 3] }
```

---

#### `PUT /:id/media/order` 🔒
Reorder media within an album. Provide the full ordered list of media IDs.

**Body:**
```json
{ "media_ids": [3, 1, 2] }
```

---

## Database Schema

```
users
  id, username, email, password, type, created_at

media
  id, user_id→users, displayname, author, filename,
  size, filepath, thumbpath, mediatype, is_favourite, updatedAt

tags
  id, user_id→users, tagname, tagcolor_hex, type

media_tags  (junction)
  tagid→tags, mediaid→media  [PK: (tagid, mediaid)]

albums
  id, user_id→users, albumname, albumcoverpath, albumthumbpath, created_at

media_albums  (junction, ordered by id)
  id, mediaid→media, albumid→albums  [UNIQUE: (mediaid, albumid)]

refresh_tokens
  id, token, userid→users, expires_at, created_at
```

---

## File Storage

Uploaded files are stored locally under:

```
server/uploads/
├── media/          ← original files
│   └── 1700000000000-123456789.jpg
└── thumbnails/     ← auto-generated previews
    └── 1700000000000-123456789.jpg
```

File names are generated as `<timestamp>-<random>.ext` to avoid collisions.

Paths are served statically — the client can access them at:
```
/uploads/media/<filename>
/uploads/thumbnails/<filename>
```

---

## Error Handling

All errors return JSON in the standard response format:

```json
{ "success": false, "message": "Descriptive error message" }
```

| Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Missing or invalid access token |
| `403` | Forbidden (insufficient permissions) |
| `404` | Resource not found |
| `500` | Internal server error |
