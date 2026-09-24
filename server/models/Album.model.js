const { pool } = require("../config/database");

// Portada cuya media está en la papelera: se oculta y vuelve al restaurarla (la portada guarda una ruta, no un id).
const COVER_IN_TRASH = `EXISTS (
    SELECT 1 FROM media cm
    WHERE cm.user_id = a.user_id AND cm.deleted_at IS NOT NULL AND (cm.filepath = a.albumcoverpath OR cm.previewpath = a.albumcoverpath)
)`;

// Álbum con su portada visible y el número de medias activas (las de la papelera no cuentan).
const ALBUM_SELECT = `SELECT a.id, a.user_id, a.albumname,
                    CASE WHEN ${COVER_IN_TRASH} THEN NULL ELSE a.albumcoverpath END AS albumcoverpath,
                    CASE WHEN ${COVER_IN_TRASH} THEN NULL ELSE a.albumthumbpath END AS albumthumbpath,
                    a.cover_position_x, a.cover_position_y, a.cover_zoom, a.created_at,
                    COUNT(m.id) AS media_count
             FROM albums a
             LEFT JOIN media_albums ma ON ma.albumid = a.id
             LEFT JOIN media m ON m.id = ma.mediaid AND m.deleted_at IS NULL`;

class AlbumModel {
    static async findDistinctNames(userId = null) {
        const ownershipCondition = userId === null ? "" : "user_id = ? AND ";
        const [rows] = await pool.query(`SELECT DISTINCT albumname FROM albums WHERE ${ownershipCondition}albumname IS NOT NULL AND TRIM(albumname) <> '' ORDER BY albumname ASC`, userId === null ? [] : [userId]);
        return rows.map((row) => row.albumname);
    }
    static async findAll() {
        const [rows] = await pool.query(
            `${ALBUM_SELECT}
             GROUP BY a.id
             ORDER BY a.id DESC`,
        );
        return rows;
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(
            `${ALBUM_SELECT}
             WHERE a.user_id = ?
             GROUP BY a.id
             ORDER BY a.id DESC`,
            [userId],
        );
        return rows;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            `${ALBUM_SELECT}
             WHERE a.id = ?
             GROUP BY a.id`,
            [id],
        );
        return rows[0] || null;
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(
            `${ALBUM_SELECT}
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

    // Cambia la ruta de las portadas que usaban una media cuyos archivos han cambiado (conserva el encuadre).
    static async replaceCoverPaths(userId, oldCoverPaths, coverpath, thumbpath) {
        if (!oldCoverPaths.length) return;
        await pool.query("UPDATE albums SET albumcoverpath = ?, albumthumbpath = ? WHERE user_id = ? AND albumcoverpath IN (?)", [coverpath, thumbpath, userId, oldCoverPaths]);
    }

    // Quita las portadas que usaban archivos que ya no existen (media borrada definitivamente).
    static async clearCoverPaths(userId, coverPaths) {
        if (!coverPaths.length) return;
        await pool.query("UPDATE albums SET albumcoverpath = NULL, albumthumbpath = NULL WHERE user_id = ? AND albumcoverpath IN (?)", [userId, coverPaths]);
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
