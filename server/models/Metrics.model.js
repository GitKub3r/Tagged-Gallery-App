// Eliminado: declaración fuera de clase de getTopDisplayName
const { pool } = require("../config/database");

class MetricsModel {
    static async getTopDisplayName(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "m");
        const [rows] = await pool.query(
            `SELECT TRIM(m.displayname) AS displayname, COUNT(*) AS usage_count
                 FROM media m
                 WHERE ${clause}
                   AND m.displayname IS NOT NULL
                   AND TRIM(m.displayname) <> ''
                 GROUP BY TRIM(m.displayname)
                 ORDER BY usage_count DESC, displayname ASC
                 LIMIT 1`,
            params,
        );
        return rows[0] || null;
    }
    static timestampColumnCache = null;

    static buildScope(requestUser, alias = "m") {
        if (requestUser.type === "admin") {
            return {
                clause: "1 = 1",
                params: [],
            };
        }

        return {
            clause: `${alias}.user_id = ?`,
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
               AND COLUMN_NAME IN ('created_at', 'updatedAt')
             ORDER BY CASE COLUMN_NAME
                 WHEN 'created_at' THEN 0
                 WHEN 'updatedAt' THEN 1
                 ELSE 2
             END`,
        );

        const availableColumns = rows.map((row) => row.column_name);
        this.timestampColumnCache = availableColumns.includes("created_at") ? "created_at" : "updatedAt";

        return this.timestampColumnCache;
    }

    static quoteIdentifier(identifier) {
        return `\`${String(identifier).replace(/`/g, "")}\``;
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
                COALESCE(COUNT(DISTINCT m.id), 0) AS tagged_media_count,
                COALESCE(COUNT(mt.id), 0) AS total_tag_assignments
             FROM media m
             LEFT JOIN media_tags mt ON mt.mediaid = m.id
             WHERE ${clause}`,
            params,
        );

        return rows[0] || { tagged_media_count: 0, total_tag_assignments: 0 };
    }

    static async getAlbumCount(requestUser) {
        const { clause, params } = this.buildScope(requestUser, "a");

        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total_albums
             FROM albums a
             WHERE ${clause}`,
            params,
        );

        return rows[0] || { total_albums: 0 };
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

    static async getTopTags(requestUser, limit = 5) {
        const { clause, params } = this.buildScope(requestUser, "t");

        const [rows] = await pool.query(
            `SELECT
                t.id,
                t.tagname,
                t.tagcolor_hex,
                t.type,
                COUNT(mt.id) AS usage_count
             FROM tags t
             LEFT JOIN media_tags mt ON mt.tagid = t.id
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
                COUNT(*) AS media_count
             FROM media m
             WHERE ${clause}
             GROUP BY m.mediatype
             ORDER BY media_count DESC, m.mediatype ASC`,
            params,
        );

        return rows;
    }

    static async getAvailableYears(requestUser, timestampColumn) {
        const { clause, params } = this.buildScope(requestUser, "m");
        const quotedColumn = this.quoteIdentifier(timestampColumn);

        const [rows] = await pool.query(
            `SELECT DISTINCT YEAR(m.${quotedColumn}) AS year
             FROM media m
             WHERE ${clause}
               AND m.${quotedColumn} IS NOT NULL
             ORDER BY year ASC`,
            params,
        );

        return rows.map((row) => Number(row.year)).filter((year) => Number.isInteger(year) && year > 0);
    }

    static async getMonthlyUploads(requestUser, timestampColumn, year) {
        const { clause, params } = this.buildScope(requestUser, "m");
        const quotedColumn = this.quoteIdentifier(timestampColumn);

        const numericYear = Number(year);
        const effectiveYear = Number.isInteger(numericYear) ? numericYear : new Date().getFullYear();

        const [rows] = await pool.query(
            `SELECT
                MONTH(m.${quotedColumn}) AS month_index,
                COUNT(*) AS media_count
             FROM media m
             WHERE ${clause}
               AND YEAR(m.${quotedColumn}) = ?
             GROUP BY MONTH(m.${quotedColumn})
             ORDER BY month_index ASC`,
            [...params, effectiveYear],
        );

        return rows;
    }

    static async getTopMediaWithTagCount(requestUser, limit = 4) {
        const { clause, params } = this.buildScope(requestUser, "m");

        const [rows] = await pool.query(
            `SELECT
                m.id,
                m.user_id,
                m.displayname,
                m.author,
                m.filename,
                m.size,
                m.filepath,
                m.thumbpath,
                m.mediatype,
                m.is_favourite,
                m.updatedAt,
                COALESCE(tag_counts.tag_count, 0) AS tag_count
             FROM media m
             LEFT JOIN (
                 SELECT mediaid, COUNT(*) AS tag_count
                 FROM media_tags
                 GROUP BY mediaid
             ) AS tag_counts ON tag_counts.mediaid = m.id
             WHERE ${clause}
             ORDER BY tag_count DESC, m.updatedAt DESC, m.id DESC
             LIMIT ?`,
            [...params, limit],
        );

        return rows;
    }
}

module.exports = MetricsModel;
