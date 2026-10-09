const { pool } = require("../config/database");
const { DRIVE_TAG_NAME } = require("../utils/driveTag");

const toEmbedding = (buffer) => (buffer ? new Float32Array(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)) : null);
const parseJson = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

class AiAssistantModel {
    // media_ai_index: análisis de cada media (huella de CLIP, tags de WD y filtro de seguridad).
    // media_ai_tags: tags que la IA ha añadido a cada media. Si el usuario quita una, no se vuelve a añadir, y
    //   tampoco cuentan como ejemplo para otras medias (la IA no aprende de sí misma).
    // ai_settings: preferencias del asistente de cada usuario.
    static async ensureTables() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_ai_index (
                media_id INT UNSIGNED PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                version SMALLINT UNSIGNED NOT NULL,
                status ENUM('ready', 'blocked', 'failed') NOT NULL,
                reason VARCHAR(32) NULL,
                embedding BLOB NULL,
                tagger_tags JSON NULL,
                analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_media_ai_index_user_status (user_id, status),
                CONSTRAINT fk_media_ai_index_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
                CONSTRAINT fk_media_ai_index_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_ai_tags (
                media_id INT UNSIGNED NOT NULL,
                tag_id INT UNSIGNED NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (media_id, tag_id),
                CONSTRAINT fk_media_ai_tags_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE,
                CONSTRAINT fk_media_ai_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ai_settings (
                user_id INT UNSIGNED PRIMARY KEY,
                strictness ENUM('strict', 'balanced', 'relaxed') NOT NULL DEFAULT 'balanced',
                excluded_tag_ids JSON NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_ai_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
    }

    // Recuento de las medias activas del usuario según su análisis con la versión actual.
    static async countLibrary(userId, version) {
        const [[row]] = await pool.query(
            `SELECT COUNT(*) AS total,
                    COALESCE(SUM(ai.status = 'ready'), 0) AS ready,
                    COALESCE(SUM(ai.status = 'blocked'), 0) AS blocked,
                    COALESCE(SUM(ai.status = 'failed'), 0) AS failed,
                    COALESCE(SUM(ai.status = 'blocked' AND ai.reason = 'minor_sexual'), 0) AS blocked_minor_sexual,
                    COALESCE(SUM(ai.status = 'blocked' AND ai.reason = 'gore'), 0) AS blocked_gore
             FROM media m
             LEFT JOIN media_ai_index ai ON ai.media_id = m.id AND ai.version = ?
             WHERE m.user_id = ? AND m.deleted_at IS NULL`,
            [version, userId],
        );
        return {
            total: Number(row.total),
            ready: Number(row.ready),
            blocked: Number(row.blocked),
            failed: Number(row.failed),
            blockedByReason: { minor_sexual: Number(row.blocked_minor_sexual), gore: Number(row.blocked_gore) },
        };
    }

    // Medias activas sin analizar con la versión actual (o cuyo análisis falló), en orden de id.
    static async findPendingMedia(userId, version, { ids = null, afterId = 0, limit = 50 } = {}) {
        if (Array.isArray(ids) && ids.length === 0) return [];
        const conditions = ["m.user_id = ?", "m.deleted_at IS NULL", "m.id > ?", "(ai.media_id IS NULL OR ai.version <> ? OR ai.status = 'failed')"];
        const values = [userId, afterId, version];
        if (ids) {
            conditions.push("m.id IN (?)");
            values.push(ids);
        }
        const [rows] = await pool.query(
            `SELECT m.id, m.thumbpath, m.previewpath, m.filepath, m.mediatype, m.storage_provider
             FROM media m
             LEFT JOIN media_ai_index ai ON ai.media_id = m.id
             WHERE ${conditions.join(" AND ")}
             ORDER BY m.id ASC LIMIT ?`,
            [...values, limit],
        );
        return rows;
    }

    static async countPendingMedia(userId, version) {
        const [[row]] = await pool.query(
            `SELECT COUNT(*) AS total FROM media m
             LEFT JOIN media_ai_index ai ON ai.media_id = m.id
             WHERE m.user_id = ? AND m.deleted_at IS NULL AND (ai.media_id IS NULL OR ai.version <> ? OR ai.status = 'failed')`,
            [userId, version],
        );
        return Number(row.total);
    }

    static async saveAnalysis({ mediaId, userId, version, status, reason = null, embedding = null, taggerTags = null }) {
        await pool.query(
            `INSERT INTO media_ai_index (media_id, user_id, version, status, reason, embedding, tagger_tags)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE version = VALUES(version), status = VALUES(status), reason = VALUES(reason),
                 embedding = VALUES(embedding), tagger_tags = VALUES(tagger_tags), analyzed_at = CURRENT_TIMESTAMP`,
            [mediaId, userId, version, status, reason, embedding ? Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength) : null, taggerTags ? JSON.stringify(taggerTags) : null],
        );
    }

    // Huellas de las medias analizadas del usuario (también las de la papelera: quien las usa filtra por sus tags).
    static async findEmbeddings(userId, version) {
        const [rows] = await pool.query("SELECT media_id, embedding FROM media_ai_index WHERE user_id = ? AND version = ? AND status = 'ready'", [userId, version]);
        return rows.map((row) => ({ mediaId: row.media_id, embedding: toEmbedding(row.embedding) }));
    }

    // Análisis de estas medias activas del usuario. Incluye las descartadas por el filtro (sin huella).
    static async findAnalyses(userId, version, mediaIds) {
        if (!mediaIds.length) return [];
        const [rows] = await pool.query(
            `SELECT ai.media_id, ai.status, ai.reason, ai.embedding, ai.tagger_tags
             FROM media_ai_index ai
             INNER JOIN media m ON m.id = ai.media_id AND m.deleted_at IS NULL
             WHERE ai.user_id = ? AND ai.version = ? AND ai.media_id IN (?)`,
            [userId, version, mediaIds],
        );
        return rows.map((row) => ({ mediaId: row.media_id, status: row.status, reason: row.reason, embedding: toEmbedding(row.embedding), taggerTags: parseJson(row.tagger_tags) }));
    }

    // Ids de las medias analizadas (activas) del usuario, por tandas, para recorrer la biblioteca.
    static async findReadyMediaIds(userId, version, { afterId = 0, limit = 200 } = {}) {
        const [rows] = await pool.query(
            `SELECT ai.media_id FROM media_ai_index ai
             INNER JOIN media m ON m.id = ai.media_id AND m.deleted_at IS NULL
             WHERE ai.user_id = ? AND ai.version = ? AND ai.status = 'ready' AND ai.media_id > ?
             ORDER BY ai.media_id ASC LIMIT ?`,
            [userId, version, afterId, limit],
        );
        return rows.map((row) => row.media_id);
    }

    // Ejemplos para aprender: tags que el usuario puso a sus medias activas. No cuentan las que añadió la IA ni la
    // tag de sistema "Google Drive" (depende del origen, no de la imagen).
    static async findUserTagPairs(userId) {
        const [rows] = await pool.query(
            `SELECT mt.mediaid AS media_id, mt.tagid AS tag_id
             FROM media_tags mt
             INNER JOIN media m ON m.id = mt.mediaid AND m.user_id = ? AND m.deleted_at IS NULL
             INNER JOIN tags t ON t.id = mt.tagid
             LEFT JOIN media_ai_tags ait ON ait.media_id = mt.mediaid AND ait.tag_id = mt.tagid
             WHERE ait.media_id IS NULL AND LOWER(t.tagname) <> LOWER(?)`,
            [userId, DRIVE_TAG_NAME],
        );
        return rows;
    }

    // Tags actuales de estas medias y las que la IA les añadió alguna vez (aunque el usuario las quitara después).
    static async findTagIdsToSkip(mediaIds) {
        if (!mediaIds.length) return [];
        const [rows] = await pool.query(
            `SELECT mediaid AS media_id, tagid AS tag_id FROM media_tags WHERE mediaid IN (?)
             UNION
             SELECT media_id, tag_id FROM media_ai_tags WHERE media_id IN (?)`,
            [mediaIds, mediaIds],
        );
        return rows;
    }

    static async recordAiTags(pairs) {
        if (!pairs.length) return;
        await pool.query("INSERT IGNORE INTO media_ai_tags (media_id, tag_id) VALUES ?", [pairs.map(({ mediaId, tagId }) => [mediaId, tagId])]);
    }

    // Tags que la IA añadió a las medias activas del usuario y cuántas siguen puestas (el resto las quitó él).
    static async getAiTagStats(userId) {
        const [[row]] = await pool.query(
            `SELECT COUNT(*) AS added, COALESCE(SUM(mt.id IS NOT NULL), 0) AS kept
             FROM media_ai_tags ait
             INNER JOIN media m ON m.id = ait.media_id AND m.user_id = ? AND m.deleted_at IS NULL
             LEFT JOIN media_tags mt ON mt.mediaid = ait.media_id AND mt.tagid = ait.tag_id`,
            [userId],
        );
        return { added: Number(row.added), kept: Number(row.kept) };
    }

    static async getSettings(userId) {
        const [[row]] = await pool.query("SELECT strictness, excluded_tag_ids FROM ai_settings WHERE user_id = ?", [userId]);
        return { strictness: row?.strictness || null, excludedTagIds: (parseJson(row?.excluded_tag_ids) || []).map(Number).filter(Number.isInteger) };
    }

    static async saveSettings(userId, { strictness, excludedTagIds }) {
        await pool.query(
            `INSERT INTO ai_settings (user_id, strictness, excluded_tag_ids) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE strictness = VALUES(strictness), excluded_tag_ids = VALUES(excluded_tag_ids)`,
            [userId, strictness, JSON.stringify(excludedTagIds)],
        );
    }
}

module.exports = AiAssistantModel;
