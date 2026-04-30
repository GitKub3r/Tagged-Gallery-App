-- =========================
-- DATABASE
-- =========================
CREATE DATABASE IF NOT EXISTS media_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE media_app;

-- =========================
-- USER
-- =========================
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- hash
    type ENUM('admin', 'basic') NOT NULL DEFAULT 'basic',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- REFRESH TOKENS
-- =========================
CREATE TABLE refresh_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(500) NOT NULL UNIQUE,
    userid INT UNSIGNED NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (userid) REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- MEDIA
-- =========================
CREATE TABLE media (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    displayname VARCHAR(255) NULL,
    author VARCHAR(100),
    filename VARCHAR(255) NOT NULL,
    size BIGINT UNSIGNED NOT NULL, -- bytes
    filepath VARCHAR(500) NOT NULL,
    thumbpath VARCHAR(500),
    mediatype ENUM('image', 'video', 'gif') NOT NULL,
    is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_media_user_id (user_id),
    CONSTRAINT fk_media_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- MANAGED MEDIA DISPLAY NAMES
-- =========================
CREATE TABLE media_displayname_values (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    displayname VARCHAR(255) NOT NULL,
    UNIQUE KEY unique_user_displayname (user_id, displayname),
    INDEX idx_media_displayname_values_user_id (user_id),
    CONSTRAINT fk_media_displayname_values_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- MANAGED MEDIA AUTHORS
-- =========================
CREATE TABLE media_author_values (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    author VARCHAR(100) NOT NULL,
    UNIQUE KEY unique_user_author (user_id, author),
    INDEX idx_media_author_values_user_id (user_id),
    CONSTRAINT fk_media_author_values_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- ALBUM
-- =========================
CREATE TABLE albums (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    albumname VARCHAR(255) NOT NULL,
    albumcoverpath VARCHAR(500),
    albumthumbpath VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_albums_user_id (user_id),
    CONSTRAINT fk_albums_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- TAG
-- =========================
CREATE TABLE tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    tagname VARCHAR(100) NOT NULL,
    tagcolor_hex CHAR(7), -- #FFFFFF
    type ENUM('default', 'copyright') NOT NULL DEFAULT 'default',
    UNIQUE KEY unique_user_tagname (user_id, tagname),
    INDEX idx_tags_user_id (user_id),
    CONSTRAINT fk_tags_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- =========================
-- TAG + MEDIA RELATION
-- =========================
CREATE TABLE media_tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tagid INT UNSIGNED NOT NULL,
    mediaid INT UNSIGNED NOT NULL,
    UNIQUE KEY unique_media_tag (tagid, mediaid),
    CONSTRAINT fk_media_tags_tag
        FOREIGN KEY (tagid) REFERENCES tags(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_media_tags_media
        FOREIGN KEY (mediaid) REFERENCES media(id)
        ON DELETE CASCADE
);

-- =========================
-- MEDIA + ALBUM RELATION
-- =========================
CREATE TABLE media_albums (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mediaid INT UNSIGNED NOT NULL,
    albumid INT UNSIGNED NOT NULL,
    UNIQUE KEY unique_media_album (mediaid, albumid),
    CONSTRAINT fk_media_albums_media
        FOREIGN KEY (mediaid) REFERENCES media(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_media_albums_album
        FOREIGN KEY (albumid) REFERENCES albums(id)
        ON DELETE CASCADE
);

-- =========================
-- ACTIONS
-- =========================
CREATE TABLE actions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actionname VARCHAR(100) NOT NULL,
    actioncode VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- HISTORY
-- =========================
CREATE TABLE history (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actionid INT UNSIGNED,
    action_code VARCHAR(50),
    userid INT UNSIGNED,
    status_code SMALLINT UNSIGNED NOT NULL DEFAULT 200,
    message VARCHAR(255),
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    metadata JSON,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_history_date (date),
    INDEX idx_history_status (status_code),
    INDEX idx_history_user (userid),
    INDEX idx_history_actionid (actionid),
    INDEX idx_history_action_code (action_code),
    INDEX idx_history_date_status (date, status_code),
    INDEX idx_history_date_action_code (date, action_code),
    CONSTRAINT fk_history_action
        FOREIGN KEY (actionid) REFERENCES actions(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_history_user
        FOREIGN KEY (userid) REFERENCES users(id)
        ON DELETE SET NULL
);

-- =========================
-- DEFAULT USERS (password: 123456, bcrypt 10 rounds)
-- =========================
INSERT INTO users (username, email, password, type) VALUES
    ('Demo User',  'demo@tagged.com',  '$2b$10$oRGNbc30oL1Xy84v6MsY0ORasKfxSr7e3/oAjgfFjTTHZCRqIkbT.', 'basic'),
    ('Admin User', 'admin@tagged.com', '$2b$10$A/IBB19E57dkmcl8C277YOo/L2gWOlvH4wrHYsomLf5Mw.2d30yqe', 'admin')
ON DUPLICATE KEY UPDATE username = VALUES(username);

INSERT INTO actions (actionname, actioncode, description, is_active)
VALUES
    ('Unauthorized access', 'AUTH_UNAUTHORIZED', 'Authentication failed or missing token', TRUE),
    ('Forbidden action', 'AUTH_FORBIDDEN', 'User tried to access a restricted resource', TRUE),
    ('Resource not found', 'ROUTE_NOT_FOUND', 'Requested endpoint does not exist', TRUE),
    ('Upload media', 'MEDIA_UPLOAD_SINGLE', 'Upload one media file', TRUE),
    ('Upload multiple media', 'MEDIA_UPLOAD_MANY', 'Upload multiple media files', TRUE),
    ('Edit media', 'MEDIA_UPDATE', 'Update media metadata', TRUE),
    ('Delete media', 'MEDIA_DELETE', 'Delete one media item', TRUE),
    ('Delete multiple media', 'MEDIA_DELETE_MANY', 'Delete multiple media items', TRUE),
    ('Create album', 'ALBUM_CREATE', 'Create a new album', TRUE),
    ('Delete album', 'ALBUM_DELETE', 'Delete an album', TRUE),
    ('Add media to album', 'ALBUM_ADD_MEDIA', 'Add one media item to an album', TRUE),
    ('Add multiple media to album', 'ALBUM_ADD_MEDIA_BATCH', 'Add several media items to an album', TRUE),
    ('Remove media from album', 'ALBUM_REMOVE_MEDIA', 'Remove one media item from an album', TRUE),
    ('Remove multiple media from album', 'ALBUM_REMOVE_MEDIA_BATCH', 'Remove several media items from an album', TRUE)
ON DUPLICATE KEY UPDATE
    actionname = VALUES(actionname),
    description = VALUES(description),
    is_active = VALUES(is_active);
