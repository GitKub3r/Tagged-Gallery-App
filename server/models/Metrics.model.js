const { pool } = require("../config/database");
const { selectMediaColumns } = require("./mediaColumns");

class MetricsModel {
    static timestampColumnCache = null;

    // Ámbito de usuario de cada métrica. Con el alias de medias ("m") excluye además las de la papelera.
    static buildScope(requestUser, alias = "m") {
        const activeMedia = alias === "m" ? " AND m.deleted_at IS NULL" : "";
        if (requestUser.type === "admin") {
            return {
                clause: `1 = 1${activeMedia}`,
                params: [],
            };
        }

        return {
            clause: `${alias}.user_id = ?${activeMedia}`,
            params: [requestUser.id],
        };
    }

    static async getMediaTimestampColumn() {
        if (this.timestampColumnCache) {
            return this.timestampColumnCache;
        }

        const [rows] = await pool.query(
            `SELECT COLUMN_NAME AS column_name
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'media'
               AND COLUMN_NAME IN ('created_at', 'updatedAt')`,
        );

        const availableColumns = rows.map((row) => row.column_name);
        this.timestampColumnCache = availableColumns.includes("created_at") ? "created_at" : "updatedAt";

        return this.timestampColumnCache;
    }

    static quoteIdentifier(identifier) {
        return `\`${String(identifier).replace(/`/g, "")}\``;
    }

    // Fecha de subida en la hora local del usuario (utcOffsetMinutes): así los días y los meses de la
    // actividad coinciden con los que ve en su calendario. El primer parámetro de la consulta es el desfase.
    static localTimestamp(timestampColumn) {
        return `TIMESTAMPADD(MINUTE, ?, CONVERT_TZ(m.${this.quoteIdentifier(timestampColumn)}, @@session.time_zone, '+00:00'))`;
    }

    static async getMediaSummary(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS total_media,
                COALESCE(SUM(m.is_favourite = 1), 0) AS favorite_media_count,
                COALESCE(SUM(m.size), 0) AS total_bytes
             FROM media m
             WHERE ${clause}`,
            params,
        );

        return rows[0] || { total_media: 0, favorite_media_count: 0, total_bytes: 0 };
    }

    static async getTagSummary(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT
                COALESCE(COUNT(DISTINCT CASE WHEN mt.id IS NOT NULL THEN m.id END), 0) AS tagged_media_count,
                COALESCE(COUNT(mt.id), 0) AS total_tag_assignments
             FROM media m
             LEFT JOIN media_tags mt ON mt.mediaid = m.id
             WHERE ${clause}`,
            params,
        );

        return rows[0] || { tagged_media_count: 0, total_tag_assignments: 0 };
    }

    // Cuántas medias tienen autor, nombre y resolución, y su orientación (de la resolución ya girada).
    static async getCoverage(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT
                COALESCE(SUM(m.author IS NOT NULL AND TRIM(m.author) <> ''), 0) AS with_author,
                COALESCE(SUM(m.displayname IS NOT NULL AND TRIM(m.displayname) <> ''), 0) AS with_displayname,
                COALESCE(SUM(m.width > m.height), 0) AS landscape,
                COALESCE(SUM(m.width < m.height), 0) AS portrait,
                COALESCE(SUM(m.width = m.height), 0) AS square
             FROM media m
             WHERE ${clause}`,
            params,
        );

        return rows[0] || {};
    }

    static async getStorageByProvider(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT m.storage_provider, COUNT(*) AS media_count, COALESCE(SUM(m.size), 0) AS total_bytes
             FROM media m
             WHERE ${clause}
             GROUP BY m.storage_provider`,
            params,
        );

        return rows;
    }

    static async getTotalTagCount(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "t");

        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total_tags
             FROM tags t
             WHERE ${clause}`,
            params,
        );

        return rows[0] || { total_tags: 0 };
    }

    static async getTopAuthors(requestUser, limit = 5) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT
                TRIM(m.author) AS author,
                COUNT(*) AS media_count
             FROM media m
             WHERE ${clause}
               AND m.author IS NOT NULL
               AND TRIM(m.author) <> ''
             GROUP BY TRIM(m.author)
             ORDER BY media_count DESC, author ASC
             LIMIT ?`,
            [...params, limit],
        );

        return rows;
    }

    static async getTopDisplayNames(requestUser, limit = 5) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT TRIM(m.displayname) AS displayname, COUNT(*) AS media_count
             FROM media m
             WHERE ${clause}
               AND m.displayname IS NOT NULL
               AND TRIM(m.displayname) <> ''
             GROUP BY TRIM(m.displayname)
             ORDER BY media_count DESC, displayname ASC
             LIMIT ?`,
            [...params, limit],
        );

        return rows;
    }

    static async getTopTags(requestUser, limit = 5) {
        const { clause, params } = this.buildScope(requestUser, "t");

        const [rows] = await pool.query(
            `SELECT
                t.id,
                t.tagname,
                t.tagcolor_hex,
                t.type,
                COUNT(tm.id) AS usage_count
             FROM tags t
             LEFT JOIN media_tags mt ON mt.tagid = t.id
             LEFT JOIN media tm ON tm.id = mt.mediaid AND tm.deleted_at IS NULL
             WHERE ${clause}
             GROUP BY t.id, t.tagname, t.tagcolor_hex, t.type
             ORDER BY usage_count DESC, t.tagname ASC
             LIMIT ?`,
            [...params, limit],
        );

        return rows;
    }

    static async getMediaTypeBreakdown(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT
                m.mediatype,
                COUNT(*) AS media_count,
                COALESCE(SUM(m.size), 0) AS total_bytes
             FROM media m
             WHERE ${clause}
             GROUP BY m.mediatype
             ORDER BY media_count DESC, m.mediatype ASC`,
            params,
        );

        return rows;
    }

    static async getAvailableYears(requestUser, timestampColumn, utcOffsetMinutes) {
        const { clause, params } = this.buildScope(requestUser, "m");
        const localTimestamp = this.localTimestamp(timestampColumn);

        const [rows] = await pool.query(
            `SELECT DISTINCT YEAR(${localTimestamp}) AS year
             FROM media m
             WHERE ${clause}
               AND m.${this.quoteIdentifier(timestampColumn)} IS NOT NULL
             ORDER BY year ASC`,
            [utcOffsetMinutes, ...params],
        );

        return rows.map((row) => Number(row.year)).filter((year) => Number.isInteger(year) && year > 0);
    }

    // Subidas por día (hora local) de un año, para el mapa de actividad.
    static async getDailyUploads(requestUser, timestampColumn, year, utcOffsetMinutes) {
        const { clause, params } = this.buildScope(requestUser, "m");
        const localTimestamp = this.localTimestamp(timestampColumn);

        const [rows] = await pool.query(
            `SELECT DATE_FORMAT(local_media.uploaded_at, '%Y-%m-%d') AS day, COUNT(*) AS media_count
             FROM (
                 SELECT ${localTimestamp} AS uploaded_at
                 FROM media m
                 WHERE ${clause}
             ) AS local_media
             WHERE YEAR(local_media.uploaded_at) = ?
             GROUP BY day
             ORDER BY day ASC`,
            [utcOffsetMinutes, ...params, year],
        );

        return rows;
    }

    static async getFirstUploadAt(requestUser, timestampColumn) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT MIN(m.${this.quoteIdentifier(timestampColumn)}) AS first_upload_at
             FROM media m
             WHERE ${clause}`,
            params,
        );

        return rows[0]?.first_upload_at || null;
    }

    // Últimas medias subidas (tira de película del panel).
    static async getRecentMedia(requestUser, timestampColumn, limit = 16) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT ${selectMediaColumns("m")}
             FROM media m
             WHERE ${clause}
             ORDER BY m.${this.quoteIdentifier(timestampColumn)} DESC, m.id DESC
             LIMIT ?`,
            [...params, limit],
        );

        return rows;
    }

    static async getTopMediaWithTagCount(requestUser, limit = 4) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT ${selectMediaColumns("m")}, COALESCE(tag_counts.tag_count, 0) AS tag_count
             FROM media m
             LEFT JOIN (
                 SELECT mediaid, COUNT(*) AS tag_count
                 FROM media_tags
                 GROUP BY mediaid
             ) AS tag_counts ON tag_counts.mediaid = m.id
             WHERE ${clause}
             ORDER BY tag_count DESC, m.id DESC
             LIMIT ?`,
            [...params, limit],
        );

        return rows;
    }

    // Álbumes, plantillas, reglas, Google Drive y papelera del usuario.
    static async getWorkspaceSummary(userId) {
        const [rows] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM albums a WHERE a.user_id = ?) AS total_albums,
                (SELECT COUNT(DISTINCT ma.mediaid)
                   FROM media_albums ma
                   JOIN albums a ON a.id = ma.albumid
                   JOIN media m ON m.id = ma.mediaid AND m.deleted_at IS NULL
                  WHERE a.user_id = ?) AS media_in_albums,
                (SELECT COUNT(*) FROM media_templates mt WHERE mt.user_id = ?) AS total_templates,
                (SELECT COUNT(*) FROM media_rules r WHERE r.user_id = ?) AS total_rules,
                (SELECT COUNT(*) FROM media_rules r WHERE r.user_id = ? AND r.is_active = TRUE) AS active_rules,
                (SELECT COALESCE(SUM(r.applied_count), 0) FROM media_rules r WHERE r.user_id = ?) AS rule_changes,
                (SELECT MAX(r.last_applied_at) FROM media_rules r WHERE r.user_id = ?) AS rules_last_applied_at,
                (SELECT g.status FROM google_drive_connections g WHERE g.user_id = ?) AS drive_status,
                (SELECT g.google_account_email FROM google_drive_connections g WHERE g.user_id = ?) AS drive_email,
                (SELECT COUNT(*) FROM media m WHERE m.user_id = ? AND m.deleted_at IS NOT NULL) AS trash_count,
                (SELECT COALESCE(SUM(m.size), 0) FROM media m WHERE m.user_id = ? AND m.deleted_at IS NOT NULL) AS trash_bytes,
                (SELECT MIN(m.deleted_at) FROM media m WHERE m.user_id = ? AND m.deleted_at IS NOT NULL) AS trash_oldest_at`,
            Array(12).fill(userId),
        );

        return rows[0] || {};
    }
}

module.exports = MetricsModel;
