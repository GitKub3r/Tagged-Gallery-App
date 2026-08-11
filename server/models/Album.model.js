const { pool } = require("../config/database");

class AlbumModel {
    static async findAll() {
        const [rows] = await pool.query(
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.cover_position_x, a.cover_position_y, a.cover_zoom, a.created_at,
                    COUNT(ma.mediaid) AS media_count
             FROM albums a
             LEFT JOIN media_albums ma ON ma.albumid = a.id
             GROUP BY a.id
             ORDER BY a.id DESC`,
        );
        return rows;
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.cover_position_x, a.cover_position_y, a.cover_zoom, a.created_at,
                    COUNT(ma.mediaid) AS media_count
             FROM albums a
             LEFT JOIN media_albums ma ON ma.albumid = a.id
             WHERE a.user_id = ?
             GROUP BY a.id
             ORDER BY a.id DESC`,
            [userId],
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.cover_position_x, a.cover_position_y, a.cover_zoom, a.created_at,
                    COUNT(ma.mediaid) AS media_count
             FROM albums a
             LEFT JOIN media_albums ma ON ma.albumid = a.id
             WHERE a.id = ?
             GROUP BY a.id`,
            [id],
        );
        return rows[0] || null;
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.cover_position_x, a.cover_position_y, a.cover_zoom, a.created_at,
                    COUNT(ma.mediaid) AS media_count
             FROM albums a
             LEFT JOIN media_albums ma ON ma.albumid = a.id
             WHERE a.id = ? AND a.user_id = ?
             GROUP BY a.id`,
            [id, userId],
        );
        return rows[0] || null;
    }

    static async create(albumname, userId) {
        const [result] = await pool.query("INSERT INTO albums (user_id, albumname) VALUES (?, ?)", [userId, albumname]);
        return {
            id: result.insertId,
            user_id: userId,
            albumname,
            albumcoverpath: null,
            albumthumbpath: null,
            media_count: 0,
        };
    }

    static async update(id, albumname) {
        const [result] = await pool.query("UPDATE albums SET albumname = ? WHERE id = ?", [albumname, id]);
        return result.affectedRows > 0;
    }

    static async updateCover(id, coverpath, thumbpath) {
        await pool.query("UPDATE albums SET albumcoverpath = ?, albumthumbpath = ?, cover_position_x = 50, cover_position_y = 50, cover_zoom = 1 WHERE id = ?", [
            coverpath,
            thumbpath,
            id,
        ]);
    }

    static async updateCoverAdjustment(id, positionX, positionY, zoom) {
        await pool.query("UPDATE albums SET cover_position_x = ?, cover_position_y = ?, cover_zoom = ? WHERE id = ?", [positionX, positionY, zoom, id]);
    }

    static async ensureCoverAdjustmentColumns() {
        const columns = [
            ["cover_position_x", "DECIMAL(5,2) NOT NULL DEFAULT 50"],
            ["cover_position_y", "DECIMAL(5,2) NOT NULL DEFAULT 50"],
            ["cover_zoom", "DECIMAL(4,2) NOT NULL DEFAULT 1"],
        ];
        for (const [name, definition] of columns) {
            const [rows] = await pool.query("SHOW COLUMNS FROM albums LIKE ?", [name]);
            if (rows.length === 0) await pool.query(`ALTER TABLE albums ADD COLUMN ${name} ${definition}`);
        }
    }

    static async removeCover(id) {
        await pool.query("UPDATE albums SET albumcoverpath = NULL, albumthumbpath = NULL WHERE id = ?", [id]);
    }

    static async delete(id) {
        const [result] = await pool.query("DELETE FROM albums WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }
}

module.exports = AlbumModel;
