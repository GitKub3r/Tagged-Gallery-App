const { pool } = require("../config/database");

// Consultas de la biblioteca demo. Cada admin puede tener una: una cuenta basic oculta (users.demo_owner_id) con
// la que se atienden sus peticiones a la biblioteca mientras tiene el modo demo activo. No aparece en el listado
// de usuarios, no puede iniciar sesión y al borrarla se borra en cascada todo su contenido.
class DemoModel {
    static async findLibraryUser(ownerId) {
        const [rows] = await pool.query("SELECT id, username, email, type FROM users WHERE demo_owner_id = ?", [ownerId]);
        return rows[0] || null;
    }

    static async createLibraryUser(ownerId, { username, email, password }) {
        const [result] = await pool.query("INSERT INTO users (username, email, password, type, demo_owner_id) VALUES (?, ?, ?, 'basic', ?)", [
            username,
            email,
            password,
            ownerId,
        ]);
        return result.insertId;
    }

    static async deleteLibraryUser(libraryId) {
        await pool.query("DELETE FROM users WHERE id = ? AND demo_owner_id IS NOT NULL", [libraryId]);
    }

    // Datos que necesita TrashService.purgeMedia para borrar los archivos de todas las medias (también las de la papelera).
    static async findMediaForPurge(libraryId) {
        const [rows] = await pool.query("SELECT id, user_id, filename, filepath, previewpath, storage_provider, source_file_id FROM media WHERE user_id = ?", [libraryId]);
        return rows;
    }

    // Devuelve un Map con el id de cada tag por nombre.
    static async insertTags(libraryId, tags) {
        const ids = new Map();
        for (const tag of tags) {
            const [result] = await pool.query("INSERT INTO tags (user_id, tagname, tagcolor_hex, type) VALUES (?, ?, ?, ?)", [libraryId, tag.name, tag.color || null, tag.type || "default"]);
            ids.set(tag.name, result.insertId);
        }
        return ids;
    }

    static async insertMedia(media) {
        const [result] = await pool.query(
            `INSERT INTO media (user_id, displayname, author, filename, size, width, height, filepath, thumbpath, previewpath, mediatype,
                is_favourite, checksum_md5, created_at, updatedAt, deleted_at, was_trashed)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                media.user_id,
                media.displayname,
                media.author,
                media.filename,
                media.size,
                media.width,
                media.height,
                media.filepath,
                media.thumbpath,
                media.previewpath,
                media.mediatype,
                media.is_favourite,
                media.checksum_md5,
                media.created_at,
                media.updated_at,
                media.deleted_at,
                media.was_trashed,
            ],
        );
        return result.insertId;
    }

    static async insertMediaTags(pairs) {
        if (pairs.length === 0) return;
        await pool.query("INSERT INTO media_tags (tagid, mediaid) VALUES ?", [pairs]);
    }

    static async insertAlbum(libraryId, { name, coverpath, thumbpath, createdAt }) {
        const [result] = await pool.query("INSERT INTO albums (user_id, albumname, albumcoverpath, albumthumbpath, created_at) VALUES (?, ?, ?, ?, ?)", [
            libraryId,
            name,
            coverpath,
            thumbpath,
            createdAt,
        ]);
        return result.insertId;
    }

    // En una sola sentencia: los ids de media_albums (que dan el orden del álbum) siguen el orden de la lista.
    static async insertAlbumMedia(albumId, mediaIds) {
        if (mediaIds.length === 0) return;
        await pool.query("INSERT INTO media_albums (mediaid, albumid) VALUES ?", [mediaIds.map((mediaId) => [mediaId, albumId])]);
    }

    static async insertTemplate(libraryId, template) {
        await pool.query("INSERT INTO media_templates (user_id, name, displayname, author, tag_names, mark_favourite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            libraryId,
            template.name,
            template.displayname,
            template.author,
            JSON.stringify(template.tags),
            template.markFavourite,
            template.createdAt,
            template.createdAt,
        ]);
    }

    static async insertRule(libraryId, rule) {
        await pool.query("INSERT INTO media_rules (user_id, name, is_active, graph, applied_count, last_applied_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            libraryId,
            rule.name,
            rule.isActive,
            JSON.stringify(rule.graph),
            rule.appliedCount,
            rule.lastAppliedAt,
            rule.createdAt,
            rule.createdAt,
        ]);
    }

    static async getSummary(libraryId) {
        const [[row]] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM media WHERE user_id = ? AND deleted_at IS NULL) AS media,
                (SELECT COUNT(*) FROM media WHERE user_id = ? AND deleted_at IS NOT NULL) AS trash,
                (SELECT COUNT(*) FROM tags WHERE user_id = ?) AS tags,
                (SELECT COUNT(*) FROM albums WHERE user_id = ?) AS albums,
                (SELECT COUNT(*) FROM media_templates WHERE user_id = ?) AS templates,
                (SELECT COUNT(*) FROM media_rules WHERE user_id = ?) AS rules`,
            Array(6).fill(libraryId),
        );
        return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value) || 0]));
    }
}

module.exports = DemoModel;
