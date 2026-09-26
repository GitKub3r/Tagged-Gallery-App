const { pool } = require("../config/database");

class MediaTagModel {
    static async createMany(mediaId, tagIds) {
        if (!tagIds || tagIds.length === 0) {
            return 0;
        }

        const values = tagIds.map((tagId) => [tagId, mediaId]);

        const [result] = await pool.query("INSERT IGNORE INTO media_tags (tagid, mediaid) VALUES ?", [values]);
        return result.affectedRows || 0;
    }

    // Medias activas (fuera de la papelera) del usuario que llevan la tag.
    static async countActiveMediaWithTag(tagId, userId) {
        const [[row]] = await pool.query(
            `SELECT COUNT(*) AS total FROM media_tags mt
             INNER JOIN media m ON m.id = mt.mediaid
             WHERE mt.tagid = ? AND m.user_id = ? AND m.deleted_at IS NULL`,
            [tagId, userId],
        );
        return Number(row.total) || 0;
    }

    // Quita la tag de las medias activas del usuario. La tag se conserva, y también en las medias de la papelera.
    static async removeTagFromActiveMedia(tagId, userId) {
        const [result] = await pool.query(
            `DELETE mt FROM media_tags mt
             INNER JOIN media m ON m.id = mt.mediaid
             WHERE mt.tagid = ? AND m.user_id = ? AND m.deleted_at IS NULL`,
            [tagId, userId],
        );
        return result.affectedRows || 0;
    }

    static async deleteDefaultTagsByMediaId(mediaId, userId) {
        const [result] = await pool.query(
            `DELETE mt
             FROM media_tags mt
             INNER JOIN tags t ON t.id = mt.tagid
             WHERE mt.mediaid = ?
               AND t.user_id = ?
               AND LOWER(COALESCE(t.type, 'default')) = 'default'`,
            [mediaId, userId],
        );

        return result.affectedRows || 0;
    }

    static async deleteTagsByMediaId(mediaId, userId) {
        const [result] = await pool.query(
            `DELETE mt
             FROM media_tags mt
             INNER JOIN tags t ON t.id = mt.tagid
             WHERE mt.mediaid = ?
               AND t.user_id = ?`,
            [mediaId, userId],
        );

        return result.affectedRows || 0;
    }

    static async deleteSpecificTagsByNameForMedia(mediaId, tagNames, userId) {
        if (!tagNames || tagNames.length === 0) {
            return 0;
        }

        const placeholders = tagNames.map(() => "LOWER(t.tagname) = LOWER(?)").join(" OR ");

        const [result] = await pool.query(
            `DELETE mt
             FROM media_tags mt
             INNER JOIN tags t ON t.id = mt.tagid
             WHERE mt.mediaid = ?
               AND t.user_id = ?
               AND (${placeholders})`,
            [mediaId, userId, ...tagNames],
        );

        return result.affectedRows || 0;
    }
}

module.exports = MediaTagModel;
