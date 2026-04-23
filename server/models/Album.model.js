const { pool } = require("../config/database");

class AlbumModel {
    static async findAll() {
        const [rows] = await pool.query(
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.created_at,
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
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.created_at,
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
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.created_at,
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
            `SELECT a.id, a.user_id, a.albumname, a.albumcoverpath, a.albumthumbpath, a.created_at,
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
        await pool.query("UPDATE albums SET albumcoverpath = ?, albumthumbpath = ? WHERE id = ?", [
            coverpath,
            thumbpath,
            id,
        ]);
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
