const { pool } = require("../config/database");

class MediaAlbumModel {
    static async addMany(albumId, mediaIds) {
        if (!mediaIds || mediaIds.length === 0) return 0;

        const values = mediaIds.map((mediaId) => [mediaId, albumId]);
        const [result] = await pool.query("INSERT IGNORE INTO media_albums (mediaid, albumid) VALUES ?", [values]);
        return result.affectedRows || 0;
    }

    static async findMediaByAlbumId(albumId) {
        const [rows] = await pool.query(
            `SELECT m.id, m.user_id, m.displayname, m.author, m.filename, m.size,
                    m.filepath, m.thumbpath, m.mediatype, m.is_favourite, m.updatedAt
             FROM media m
             INNER JOIN media_albums ma ON ma.mediaid = m.id
             WHERE ma.albumid = ?
             ORDER BY ma.id ASC`,
            [albumId],
        );
        return rows;
    }

    static async findMediaIdsByAlbumId(albumId) {
        const [rows] = await pool.query("SELECT mediaid FROM media_albums WHERE albumid = ? ORDER BY id ASC", [
            albumId,
        ]);
        return rows.map((row) => Number(row.mediaid)).filter((id) => Number.isInteger(id) && id > 0);
    }

    static async replaceOrder(albumId, mediaIds) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.query("DELETE FROM media_albums WHERE albumid = ?", [albumId]);

            if (mediaIds.length > 0) {
                const values = mediaIds.map((mediaId) => [mediaId, albumId]);
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
