const { pool } = require("../config/database");
const { selectMediaColumns } = require("./mediaColumns");

const MEDIA_COLUMNS = selectMediaColumns();

class MediaModel {
    // Columnas añadidas después del esquema inicial. Idempotente: se ejecuta al arrancar el servidor.
    static async ensureColumns() {
        const [columnRows] = await pool.query("SHOW COLUMNS FROM media");
        const existingColumns = new Set(columnRows.map((column) => column.Field));
        const columnDefinitions = [
            ["previewpath", "VARCHAR(500) NULL AFTER thumbpath"],
            ["storage_provider", "ENUM('local', 'google_drive') NOT NULL DEFAULT 'local' AFTER is_favourite"],
            ["storage_status", "ENUM('available', 'missing', 'revoked', 'error') NOT NULL DEFAULT 'available' AFTER storage_provider"],
            ["source_file_id", "VARCHAR(255) NULL AFTER storage_status"],
            ["source_mime_type", "VARCHAR(255) NULL AFTER source_file_id"],
            ["source_modified_time", "DATETIME NULL AFTER source_mime_type"],
            ["last_synced_at", "DATETIME NULL AFTER source_modified_time"],
            ["checksum_md5", "CHAR(32) NULL AFTER last_synced_at"],
            // Papelera: fecha en la que se envió a la papelera (NULL = activa). Se borra definitivamente a los 30 días.
            ["deleted_at", "DATETIME NULL DEFAULT NULL"],
            ["created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER deleted_at"],
            // Resolución del original (la que se ve, ya girada). NULL si no se pudo leer: ver dimensions:backfill.
            ["width", "INT UNSIGNED NULL AFTER size"],
            ["height", "INT UNSIGNED NULL AFTER width"],
            // Se marca al enviarla a la papelera y se conserva al restaurarla (regla "Was in the trash").
            ["was_trashed", "BOOLEAN NOT NULL DEFAULT FALSE AFTER deleted_at"],
        ];

        for (const [name, definition] of columnDefinitions) {
            if (!existingColumns.has(name)) {
                await pool.query(`ALTER TABLE media ADD COLUMN ${name} ${definition}`);
            }
        }
        // Las que ya estaban en la papelera al crear la columna también cuentan.
        if (!existingColumns.has("was_trashed")) {
            await pool.query("UPDATE media SET was_trashed = TRUE WHERE deleted_at IS NOT NULL");
        }

        const [indexRows] = await pool.query("SHOW INDEX FROM media");
        const existingIndexes = new Set(indexRows.map((index) => index.Key_name));
        if (!existingIndexes.has("uq_media_user_source")) {
            await pool.query("ALTER TABLE media ADD UNIQUE KEY uq_media_user_source (user_id, storage_provider, source_file_id)");
        }
        if (!existingIndexes.has("idx_media_user_checksum")) {
            await pool.query("ALTER TABLE media ADD INDEX idx_media_user_checksum (user_id, checksum_md5)");
        }
        if (!existingIndexes.has("idx_media_user_deleted")) {
            await pool.query("ALTER TABLE media ADD INDEX idx_media_user_deleted (user_id, deleted_at)");
        }
    }

    static async ensureManagedValuesTables() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_displayname_values (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                displayname VARCHAR(255) NOT NULL,
                UNIQUE KEY unique_user_displayname (user_id, displayname),
                INDEX idx_media_displayname_values_user_id (user_id),
                CONSTRAINT fk_media_displayname_values_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_author_values (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                author VARCHAR(100) NOT NULL,
                UNIQUE KEY unique_user_author (user_id, author),
                INDEX idx_media_author_values_user_id (user_id),
                CONSTRAINT fk_media_author_values_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);
    }

    static async findAll() {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE deleted_at IS NULL ORDER BY id DESC`,
        );
        return rows;
    }

    static async countAll() {
        const [[row]] = await pool.query("SELECT COUNT(*) AS total FROM media WHERE deleted_at IS NULL");
        return row.total;
    }

    static async findAllPaginated(page, limit) {
        const offset = (page - 1) * limit;
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?`,
            [limit, offset],
        );
        return rows;
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC`,
            [userId],
        );
        return rows;
    }

    static async countByUserId(userId) {
        const [[row]] = await pool.query("SELECT COUNT(*) AS total FROM media WHERE user_id = ? AND deleted_at IS NULL", [userId]);
        return row.total;
    }

    static async findAllByUserIdPaginated(userId, page, limit) {
        const offset = (page - 1) * limit;
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE user_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?`,
            [userId, limit, offset],
        );
        return rows;
    }

    static async findFilteredPaginated({
        userId = null,
        page = 1,
        limit = 20,
        favouritesOnly = false,
        mediaType = "all",
        author = "",
        tag = "",
        includeTags = [],
        excludeTags = [],
        authorTerms = [],
        nameTerms = [],
        nameMatchMode = "normal",
        freeTerms = [],
        randomSeed = null,
    } = {}) {
        const conditions = ["m.deleted_at IS NULL"];
        const values = [];

        if (userId !== null && userId !== undefined) {
            conditions.push("m.user_id = ?");
            values.push(userId);
        }
        if (favouritesOnly) conditions.push("m.is_favourite = 1");
        if (mediaType === "image") {
            conditions.push("LOWER(COALESCE(m.mediatype, '')) NOT LIKE '%video%' AND LOWER(COALESCE(m.mediatype, '')) NOT LIKE '%gif%'");
        } else if (mediaType === "video") {
            conditions.push("(LOWER(COALESCE(m.mediatype, '')) LIKE '%video%' OR LOWER(COALESCE(m.mediatype, '')) LIKE '%gif%')");
        }
        if (author) {
            conditions.push("LOWER(COALESCE(m.author, '')) = ?");
            values.push(String(author).toLowerCase());
        }

        const addTagExistsCondition = (tagName, negate = false) => {
            conditions.push(`${negate ? "NOT " : ""}EXISTS (
                SELECT 1 FROM media_tags mt
                INNER JOIN tags t ON t.id = mt.tagid
                WHERE mt.mediaid = m.id AND LOWER(t.tagname) = ?
            )`);
            values.push(String(tagName).toLowerCase());
        };

        if (tag) addTagExistsCondition(tag);
        includeTags.forEach((tagName) => addTagExistsCondition(tagName));
        excludeTags.forEach((tagName) => addTagExistsCondition(tagName, true));
        if (authorTerms.length > 0) {
            conditions.push(`(${authorTerms.map(() => "LOWER(COALESCE(m.author, '')) = ?").join(" OR ")})`);
            values.push(...authorTerms.map((term) => String(term).toLowerCase()));
        }
        if (nameTerms.length > 0) {
            const isStrictNameMatch = nameMatchMode === "strict";
            conditions.push(`(${nameTerms.map(() => `LOWER(COALESCE(m.displayname, '')) ${isStrictNameMatch ? "=" : "LIKE"} ?`).join(" OR ")})`);
            values.push(...nameTerms.map((term) => {
                const normalized = String(term).toLowerCase();
                return isStrictNameMatch ? normalized : `%${normalized}%`;
            }));
        }
        freeTerms.forEach((term) => {
            conditions.push("LOWER(CONCAT(COALESCE(m.displayname, ''), ' ', COALESCE(m.author, ''))) LIKE ?");
            values.push(`%${String(term).toLowerCase()}%`);
        });

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const offset = (page - 1) * limit;
        const hasRandomSeed = randomSeed !== null && randomSeed !== undefined && randomSeed !== "";
        const safeRandomSeed = hasRandomSeed && Number.isInteger(Number(randomSeed)) ? Number(randomSeed) : null;
        const orderClause = safeRandomSeed === null ? "ORDER BY m.id DESC" : "ORDER BY RAND(?)";
        const pageValues = safeRandomSeed === null
            ? [...values, limit, offset]
            : [...values, safeRandomSeed, limit, offset];

        const [[countRow], [rows]] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total FROM media m ${whereClause}`, values).then(([countRows]) => countRows),
            pool.query(
                `SELECT ${selectMediaColumns("m")}
                 FROM media m
                 ${whereClause}
                 ${orderClause}
                 LIMIT ? OFFSET ?`,
                pageValues,
            ),
        ]);

        return { rows, total: Number(countRow?.total) || 0 };
    }

    static async findDistinctDisplayNames() {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS displayname, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(displayname) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE deleted_at IS NULL AND displayname IS NOT NULL AND TRIM(displayname) <> ''
                    GROUP BY TRIM(displayname)

                    UNION ALL

                    SELECT displayname AS value, 0 AS usage_count
                    FROM media_displayname_values
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
        );
        return rows;
    }

    static async findDistinctDisplayNamesByUserId(userId) {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS displayname, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(displayname) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE user_id = ? AND deleted_at IS NULL AND displayname IS NOT NULL AND TRIM(displayname) <> ''
                    GROUP BY TRIM(displayname)

                    UNION ALL

                    SELECT displayname AS value, 0 AS usage_count
                    FROM media_displayname_values
                    WHERE user_id = ?
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
            [userId, userId],
        );
        return rows;
    }

    static async findDistinctAuthors() {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS author, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(author) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE deleted_at IS NULL AND author IS NOT NULL AND TRIM(author) <> ''
                    GROUP BY TRIM(author)

                    UNION ALL

                    SELECT author AS value, 0 AS usage_count
                    FROM media_author_values
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
        );
        return rows;
    }

    static async findDistinctAuthorsByUserId(userId) {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS author, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(author) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE user_id = ? AND deleted_at IS NULL AND author IS NOT NULL AND TRIM(author) <> ''
                    GROUP BY TRIM(author)

                    UNION ALL

                    SELECT author AS value, 0 AS usage_count
                    FROM media_author_values
                    WHERE user_id = ?
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
            [userId, userId],
        );
        return rows;
    }

    static async createManagedDisplayName(userId, displayname) {
        await this.ensureManagedValuesTables();
        await pool.query("INSERT IGNORE INTO media_displayname_values (user_id, displayname) VALUES (?, ?)", [
            userId,
            displayname,
        ]);
    }

    static async renameManagedDisplayNameForUser(userId, previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query(
            "UPDATE media SET displayname = ? WHERE user_id = ? AND TRIM(displayname) = ?",
            [nextValue, userId, previousValue],
        );

        await pool.query("DELETE FROM media_displayname_values WHERE user_id = ? AND displayname = ?", [
            userId,
            previousValue,
        ]);
        await pool.query("INSERT IGNORE INTO media_displayname_values (user_id, displayname) VALUES (?, ?)", [
            userId,
            nextValue,
        ]);

        return result.affectedRows || 0;
    }

    static async renameManagedDisplayName(previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET displayname = ? WHERE TRIM(displayname) = ?", [
            nextValue,
            previousValue,
        ]);

        await pool.query("DELETE FROM media_displayname_values WHERE displayname = ?", [previousValue]);
        await pool.query("INSERT IGNORE INTO media_displayname_values (user_id, displayname) SELECT id, ? FROM users", [
            nextValue,
        ]);

        return result.affectedRows || 0;
    }

    static async deleteManagedDisplayNameForUser(userId, valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query(
            "UPDATE media SET displayname = CONCAT('Untitled ', id) WHERE user_id = ? AND TRIM(displayname) = ?",
            [userId, valueToDelete],
        );

        await pool.query("DELETE FROM media_displayname_values WHERE user_id = ? AND displayname = ?", [
            userId,
            valueToDelete,
        ]);

        return result.affectedRows || 0;
    }

    static async deleteManagedDisplayName(valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query(
            "UPDATE media SET displayname = CONCAT('Untitled ', id) WHERE TRIM(displayname) = ?",
            [valueToDelete],
        );

        await pool.query("DELETE FROM media_displayname_values WHERE displayname = ?", [valueToDelete]);

        return result.affectedRows || 0;
    }

    static async createManagedAuthor(userId, author) {
        await this.ensureManagedValuesTables();
        await pool.query("INSERT IGNORE INTO media_author_values (user_id, author) VALUES (?, ?)", [userId, author]);
    }

    static async renameManagedAuthorForUser(userId, previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = ? WHERE user_id = ? AND TRIM(author) = ?", [
            nextValue,
            userId,
            previousValue,
        ]);

        await pool.query("DELETE FROM media_author_values WHERE user_id = ? AND author = ?", [userId, previousValue]);
        await pool.query("INSERT IGNORE INTO media_author_values (user_id, author) VALUES (?, ?)", [userId, nextValue]);

        return result.affectedRows || 0;
    }

    static async renameManagedAuthor(previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = ? WHERE TRIM(author) = ?", [
            nextValue,
            previousValue,
        ]);

        await pool.query("DELETE FROM media_author_values WHERE author = ?", [previousValue]);
        await pool.query("INSERT IGNORE INTO media_author_values (user_id, author) SELECT id, ? FROM users", [
            nextValue,
        ]);

        return result.affectedRows || 0;
    }

    static async deleteManagedAuthorForUser(userId, valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = NULL WHERE user_id = ? AND TRIM(author) = ?", [
            userId,
            valueToDelete,
        ]);

        await pool.query("DELETE FROM media_author_values WHERE user_id = ? AND author = ?", [userId, valueToDelete]);

        return result.affectedRows || 0;
    }

    static async deleteManagedAuthor(valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = NULL WHERE TRIM(author) = ?", [valueToDelete]);

        await pool.query("DELETE FROM media_author_values WHERE author = ?", [valueToDelete]);

        return result.affectedRows || 0;
    }

    static async create(mediaData) {
        const {
            user_id,
            displayname,
            author,
            filename,
            size,
            filepath,
            thumbpath,
            previewpath = null,
            mediatype,
            is_favourite,
            checksum_md5 = null,
            width = null,
            height = null,
            storage_provider = "local",
            source_file_id = null,
            source_mime_type = null,
            source_modified_time = null,
            last_synced_at = null,
        } = mediaData;
        const normalizedDisplayName =
            displayname === undefined || displayname === null || displayname === "" ? null : displayname;
        const normalizedAuthor = author === undefined || author === null || author === "" ? null : author;

        const [result] = await pool.query(
            `INSERT INTO media (user_id, displayname, author, filename, size, width, height, filepath, thumbpath, previewpath, mediatype, is_favourite, checksum_md5,
                storage_provider, source_file_id, source_mime_type, source_modified_time, last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                normalizedDisplayName,
                normalizedAuthor,
                filename,
                size,
                width,
                height,
                filepath,
                thumbpath,
                previewpath,
                mediatype,
                Boolean(is_favourite),
                checksum_md5,
                storage_provider,
                source_file_id,
                source_mime_type,
                source_modified_time,
                last_synced_at,
            ],
        );

        return {
            id: result.insertId,
            user_id,
            displayname: normalizedDisplayName,
            author: normalizedAuthor,
            filename,
            size,
            filepath,
            thumbpath,
            previewpath,
            mediatype,
            is_favourite: Boolean(is_favourite),
            storage_provider,
            storage_status: "available",
            source_file_id,
        };
    }

    // Ids de Drive que el usuario ya tiene vinculados, para no vincularlos dos veces.
    // Da la tag de sistema de Drive a las medias de Drive que no la tengan (medias vinculadas antes de existir).
    static async ensureDriveTags(tagName) {
        await pool.query(
            `INSERT IGNORE INTO tags (user_id, tagname, type)
             SELECT DISTINCT user_id, ?, 'default' FROM media WHERE storage_provider = 'google_drive'`,
            [tagName],
        );
        await pool.query(
            `INSERT IGNORE INTO media_tags (tagid, mediaid)
             SELECT t.id, m.id FROM media m
             JOIN tags t ON t.user_id = m.user_id AND t.tagname = ?
             WHERE m.storage_provider = 'google_drive'`,
            [tagName],
        );
    }

    static async findDriveMediaBySource(userId, fileId) {
        const [[row]] = await pool.query(
            "SELECT id, source_mime_type FROM media WHERE user_id = ? AND storage_provider = 'google_drive' AND source_file_id = ? AND deleted_at IS NULL LIMIT 1",
            [userId, fileId],
        );
        return row || null;
    }

    // Pasa una media de Drive a almacenamiento local (solo si sigue siendo de Drive).
    static async convertDriveToLocal(mediaId, { filename, size, width = null, height = null, filepath, thumbpath, previewpath, checksum_md5 }) {
        const [result] = await pool.query(
            `UPDATE media SET storage_provider = 'local', storage_status = 'available', source_file_id = NULL, source_mime_type = NULL,
                 source_modified_time = NULL, last_synced_at = NULL, filename = ?, size = ?, width = COALESCE(?, width), height = COALESCE(?, height),
                 filepath = ?, thumbpath = ?, previewpath = ?, checksum_md5 = ?
             WHERE id = ? AND storage_provider = 'google_drive'`,
            [filename, size, width, height, filepath, thumbpath, previewpath, checksum_md5, mediaId],
        );
        return result.affectedRows > 0;
    }

    static async updateDerivativePaths(mediaId, { thumbpath, previewpath }) {
        await pool.query("UPDATE media SET thumbpath = ?, previewpath = ? WHERE id = ?", [thumbpath, previewpath, mediaId]);
    }

    // Medias de Drive (incluidas las de la papelera) que aún muestran el original porque no tienen preview local.
    static async findDriveImagesWithoutPreview() {
        const [rows] = await pool.query(
            `SELECT id, user_id, filepath, thumbpath, source_file_id FROM media
             WHERE storage_provider = 'google_drive' AND storage_status = 'available' AND previewpath IS NULL
               AND source_mime_type LIKE 'image/%' AND source_mime_type <> 'image/gif'`,
        );
        return rows;
    }

    // Datos que evalúan las reglas (utils/ruleGraph.js). Solo medias activas del usuario.
    static async findRuleSnapshots(userId, { ids = null, afterId = 0, limit = null } = {}) {
        if (Array.isArray(ids) && ids.length === 0) return [];
        const conditions = ["user_id = ?", "deleted_at IS NULL", "id > ?"];
        const values = [userId, afterId];
        if (ids) {
            conditions.push("id IN (?)");
            values.push(ids);
        }
        const [rows] = await pool.query(
            `SELECT id, user_id, displayname, author, size, width, height, mediatype, is_favourite, was_trashed, storage_provider
             FROM media WHERE ${conditions.join(" AND ")} ORDER BY id ASC${limit ? " LIMIT ?" : ""}`,
            limit ? [...values, limit] : values,
        );
        return rows;
    }

    // Medias (también las de la papelera) sin resolución guardada.
    static async findWithoutDimensions() {
        const [rows] = await pool.query(
            "SELECT id, user_id, filename, mediatype, storage_provider, source_file_id FROM media WHERE width IS NULL OR height IS NULL ORDER BY id ASC",
        );
        return rows;
    }

    static async updateDimensions(mediaId, { width, height }) {
        await pool.query("UPDATE media SET width = ?, height = ? WHERE id = ?", [width, height, mediaId]);
    }

    static async updateStorageStatus(mediaId, status) {
        await pool.query("UPDATE media SET storage_status = ? WHERE id = ?", [status, mediaId]);
    }

    // Incluye las medias en la papelera: el archivo de Drive sigue vinculado hasta que se borran definitivamente.
    static async findLinkedDriveFileIds(userId, fileIds) {
        if (!fileIds.length) return new Set();
        const [rows] = await pool.query(
            "SELECT source_file_id FROM media WHERE user_id = ? AND storage_provider = 'google_drive' AND source_file_id IN (?)",
            [userId, fileIds],
        );
        return new Set(rows.map((row) => row.source_file_id));
    }

    // Resumen de las medias del usuario cuyo original vive en Google Drive.
    static async getDriveSummary(userId) {
        const [[row]] = await pool.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(mediatype IN ('image', 'gif')), 0) AS photos,
                    COALESCE(SUM(mediatype = 'video'), 0) AS videos,
                    COALESCE(SUM(size), 0) AS total_bytes,
                    COALESCE(SUM(storage_status <> 'available'), 0) AS unavailable,
                    MAX(created_at) AS last_added_at
             FROM media
             WHERE user_id = ? AND storage_provider = 'google_drive' AND deleted_at IS NULL`,
            [userId],
        );
        return {
            total: Number(row.total),
            photos: Number(row.photos),
            videos: Number(row.videos),
            totalBytes: Number(row.total_bytes),
            unavailable: Number(row.unavailable),
            lastAddedAt: row.last_added_at,
        };
    }

    static async findRecentDriveMedia(userId, limit) {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE user_id = ? AND storage_provider = 'google_drive' AND deleted_at IS NULL ORDER BY id DESC LIMIT ?`,
            [userId, limit],
        );
        return rows;
    }

    // Medias locales del usuario con alguno de estos MD5 (posibles duplicados de archivos de Drive).
    static async findLocalByChecksums(userId, checksums) {
        if (!checksums.length) return [];
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS}, checksum_md5 FROM media WHERE user_id = ? AND storage_provider = 'local' AND deleted_at IS NULL AND checksum_md5 IN (?)`,
            [userId, checksums],
        );
        return rows;
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [id, userId],
        );
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ? AND deleted_at IS NULL`,
            [id],
        );
        return rows[0];
    }

    static async findByIds(ids) {
        if (!ids || ids.length === 0) {
            return [];
        }

        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE id IN (?) AND deleted_at IS NULL`,
            [ids],
        );
        return rows;
    }

    static async findByIdsForUser(ids, userId) {
        if (!ids || ids.length === 0) {
            return [];
        }

        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS} FROM media WHERE id IN (?) AND user_id = ? AND deleted_at IS NULL`,
            [ids, userId],
        );
        return rows;
    }

    static async toggleFavourite(id) {
        const [result] = await pool.query("UPDATE media SET is_favourite = NOT is_favourite WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }

    static async update(id, fields) {
        const parts = [];
        const values = [];

        if (fields.displayname !== undefined) {
            parts.push("displayname = ?");
            values.push(fields.displayname);
        }
        if (fields.author !== undefined) {
            parts.push("author = ?");
            values.push(fields.author);
        }
        if (fields.is_favourite !== undefined) {
            parts.push("is_favourite = ?");
            values.push(fields.is_favourite);
        }

        if (parts.length === 0) return null;

        values.push(id);
        const [result] = await pool.query(`UPDATE media SET ${parts.join(", ")} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    // --- Papelera ---

    // Envía medias activas a la papelera. Sus tags y álbumes se conservan para poder restaurarlas.
    static async moveToTrash(ids) {
        if (!ids.length) return 0;
        const [result] = await pool.query("UPDATE media SET deleted_at = NOW(), was_trashed = TRUE WHERE id IN (?) AND deleted_at IS NULL", [ids]);
        return result.affectedRows || 0;
    }

    static async restoreFromTrash(ids, userId) {
        if (!ids.length) return 0;
        const [result] = await pool.query("UPDATE media SET deleted_at = NULL WHERE id IN (?) AND user_id = ? AND deleted_at IS NOT NULL", [ids, userId]);
        return result.affectedRows || 0;
    }

    // Medias en la papelera, las más recientes primero, con la fecha de borrado.
    static async findTrashByUserId(userId) {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS}, deleted_at FROM media WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC`,
            [userId],
        );
        return rows;
    }

    // Medias de la papelera de un usuario (ids = null: todas).
    static async findTrashedForUser(userId, ids = null) {
        if (Array.isArray(ids) && ids.length === 0) return [];
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS}, deleted_at FROM media WHERE user_id = ? AND deleted_at IS NOT NULL${ids ? " AND id IN (?)" : ""}`,
            ids ? [userId, ids] : [userId],
        );
        return rows;
    }

    // Medias de cualquier usuario que llevan en la papelera más de retentionDays días.
    static async findExpiredTrash(retentionDays, limit) {
        const [rows] = await pool.query(
            `SELECT ${MEDIA_COLUMNS}, deleted_at FROM media WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL ? DAY ORDER BY deleted_at ASC LIMIT ?`,
            [retentionDays, limit],
        );
        return rows;
    }

    static async delete(id) {
        const [result] = await pool.query("DELETE FROM media WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }

    static async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            return 0;
        }

        const [result] = await pool.query("DELETE FROM media WHERE id IN (?)", [ids]);
        return result.affectedRows || 0;
    }

    static async createMany(mediaList) {
        if (!mediaList.length) {
            return [];
        }

        const values = mediaList.map((item) => [
            item.user_id,
            item.displayname === undefined || item.displayname === null || item.displayname === ""
                ? null
                : item.displayname,
            item.author === undefined || item.author === null || item.author === "" ? null : item.author,
            item.filename,
            item.size,
            item.width ?? null,
            item.height ?? null,
            item.filepath,
            item.thumbpath,
            item.previewpath || null,
            item.mediatype,
            Boolean(item.is_favourite),
            item.checksum_md5 || null,
        ]);

        const [result] = await pool.query(
            "INSERT INTO media (user_id, displayname, author, filename, size, width, height, filepath, thumbpath, previewpath, mediatype, is_favourite, checksum_md5) VALUES ?",
            [values],
        );

        return mediaList.map((item, index) => ({
            id: result.insertId + index,
            ...item,
        }));
    }
}

module.exports = MediaModel;
