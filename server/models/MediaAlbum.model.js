const { pool } = require("../config/database");
const { selectMediaColumns } = require("./mediaColumns");

class MediaAlbumModel {
    static async addMany(albumId, mediaIds) {
        if (!mediaIds || mediaIds.length === 0) return 0;

        const values = mediaIds.map((mediaId) => [mediaId, albumId]);
        const [result] = await pool.query("INSERT IGNORE INTO media_albums (mediaid, albumid) VALUES ?", [values]);
        return result.affectedRows || 0;
    }

    static async findAlbumIdsByMediaIds(mediaIds) {
        if (!mediaIds || mediaIds.length === 0) return [];
        const [rows] = await pool.query("SELECT mediaid, albumid FROM media_albums WHERE mediaid IN (?)", [mediaIds]);
        return rows;
    }

    static async findMediaByAlbumId(albumId) {
        const [rows] = await pool.query(
            `SELECT ${selectMediaColumns("m")}
             FROM media m
             INNER JOIN media_albums ma ON ma.mediaid = m.id
             WHERE ma.albumid = ? AND m.deleted_at IS NULL
             ORDER BY ma.id ASC`,
            [albumId],
        );
        return rows;
    }

    // Medias activas del álbum, en orden (las de la papelera no se pueden reordenar).
    static async findMediaIdsByAlbumId(albumId) {
        const [rows] = await pool.query(
            `SELECT ma.mediaid FROM media_albums ma INNER JOIN media m ON m.id = ma.mediaid
             WHERE ma.albumid = ? AND m.deleted_at IS NULL ORDER BY ma.id ASC`,
            [albumId],
        );
        return rows.map((row) => Number(row.mediaid)).filter((id) => Number.isInteger(id) && id > 0);
    }

    // Reordena las medias activas. Las que están en la papelera conservan su hueco, así al restaurarlas
    // vuelven a la misma posición del álbum.
    static async replaceOrder(albumId, mediaIds) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [currentRows] = await connection.query(
                `SELECT ma.mediaid, m.deleted_at IS NOT NULL AS in_trash FROM media_albums ma INNER JOIN media m ON m.id = ma.mediaid
                 WHERE ma.albumid = ? ORDER BY ma.id ASC`,
                [albumId],
            );
            const activeQueue = [...mediaIds];
            const orderedIds = currentRows.map((row) => (row.in_trash ? row.mediaid : activeQueue.shift())).filter((id) => id !== undefined);
            orderedIds.push(...activeQueue);

            await connection.query("DELETE FROM media_albums WHERE albumid = ?", [albumId]);

            if (orderedIds.length > 0) {
                const values = orderedIds.map((mediaId) => [mediaId, albumId]);
                await connection.query("INSERT INTO media_albums (mediaid, albumid) VALUES ?", [values]);
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async removeOne(albumId, mediaId) {
        const [result] = await pool.query("DELETE FROM media_albums WHERE albumid = ? AND mediaid = ?", [
            albumId,
            mediaId,
        ]);
        return result.affectedRows > 0;
    }

    static async removeMany(albumId, mediaIds) {
        if (!mediaIds || mediaIds.length === 0) return 0;

        const [result] = await pool.query("DELETE FROM media_albums WHERE albumid = ? AND mediaid IN (?)", [
            albumId,
            mediaIds,
        ]);
        return result.affectedRows || 0;
    }
}

module.exports = MediaAlbumModel;
