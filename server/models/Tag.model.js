const { pool } = require("../config/database");

class TagModel {
    static async findAll() {
        const [rows] = await pool.query(
            "SELECT id, user_id, tagname, tagcolor_hex, type FROM tags ORDER BY tagname ASC",
        );
        return rows;
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(
            "SELECT id, user_id, tagname, tagcolor_hex, type FROM tags WHERE user_id = ? ORDER BY tagname ASC",
            [userId],
        );
        return rows;
    }

    static async findDistinctTagNames() {
        const [rows] = await pool.query(
            "SELECT DISTINCT tagname FROM tags WHERE tagname IS NOT NULL AND TRIM(tagname) <> '' ORDER BY tagname ASC",
        );
        return rows;
    }

    static async findDistinctTagNamesByUserId(userId) {
        const [rows] = await pool.query(
            "SELECT DISTINCT tagname FROM tags WHERE user_id = ? AND tagname IS NOT NULL AND TRIM(tagname) <> '' ORDER BY tagname ASC",
            [userId],
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query("SELECT id, user_id, tagname, tagcolor_hex, type FROM tags WHERE id = ?", [id]);
        return rows[0];
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(
            "SELECT id, user_id, tagname, tagcolor_hex, type FROM tags WHERE id = ? AND user_id = ?",
            [id, userId],
        );
        return rows[0];
    }

    static async findByTagnameForUser(tagname, userId) {
        const [rows] = await pool.query(
            "SELECT id, user_id, tagname, tagcolor_hex, type FROM tags WHERE tagname = ? AND user_id = ?",
            [tagname, userId],
        );
        return rows[0];
    }

    static async findByMediaId(mediaId) {
        const [rows] = await pool.query(
            `SELECT
                mt.mediaid,
                t.id,
                t.user_id,
                t.tagname,
                t.tagcolor_hex,
                t.type
            FROM media_tags mt
            INNER JOIN tags t ON t.id = mt.tagid
            WHERE mt.mediaid = ?
            ORDER BY t.tagname ASC`,
            [mediaId],
        );
        return rows;
    }

    static async findByMediaIds(mediaIds) {
        if (!mediaIds || mediaIds.length === 0) {
            return [];
        }

        const [rows] = await pool.query(
            `SELECT
                mt.mediaid,
                t.id,
                t.user_id,
                t.tagname,
                t.tagcolor_hex,
                t.type
            FROM media_tags mt
            INNER JOIN tags t ON t.id = mt.tagid
            WHERE mt.mediaid IN (?)
            ORDER BY mt.mediaid ASC, t.tagname ASC`,
            [mediaIds],
        );
        return rows;
    }

    static async tagnameExists(tagname, userId, excludeId = null) {
        if (excludeId) {
            const [rows] = await pool.query("SELECT id FROM tags WHERE tagname = ? AND user_id = ? AND id != ?", [
                tagname,
                userId,
                excludeId,
            ]);
            return rows.length > 0;
        }

        const [rows] = await pool.query("SELECT id FROM tags WHERE tagname = ? AND user_id = ?", [tagname, userId]);
        return rows.length > 0;
    }

    static async create(tagData) {
        const { user_id, tagname, tagcolor_hex, type } = tagData;

        const [result] = await pool.query(
            "INSERT INTO tags (user_id, tagname, tagcolor_hex, type) VALUES (?, ?, ?, ?)",
            [user_id, tagname, tagcolor_hex || null, type || "default"],
        );

        return {
            id: result.insertId,
            user_id,
            tagname,
            tagcolor_hex: tagcolor_hex || null,
            type: type || "default",
        };
    }

    static async update(id, tagData) {
        const fields = [];
        const values = [];

        if (tagData.tagname !== undefined) {
            fields.push("tagname = ?");
            values.push(tagData.tagname);
        }
        if (tagData.tagcolor_hex !== undefined) {
            fields.push("tagcolor_hex = ?");
            values.push(tagData.tagcolor_hex);
        }
        if (tagData.type !== undefined) {
            fields.push("type = ?");
            values.push(tagData.type);
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(id);

        const [result] = await pool.query(`UPDATE tags SET ${fields.join(", ")} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await pool.query("DELETE FROM tags WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }
}

module.exports = TagModel;
