const MediaModel = require("../models/Media.model");
const AlbumModel = require("../models/Album.model");
const AuditService = require("./Audit.service");
const MediaService = require("./Media.service");
const RuleEngineService = require("./RuleEngine.service");
const { removeStoredMediaFiles } = require("../utils/media");

// Días que una media pasa en la papelera antes de borrarse definitivamente.
const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// La purga automática se revisa cada hora y borra por tandas para no bloquear la base de datos.
const PURGE_INTERVAL_MS = 60 * 60 * 1000;
const PURGE_BATCH_SIZE = 200;
const MAX_TRASH_IDS = 500;

const parseIds = (rawIds) => {
    const ids = [...new Set((Array.isArray(rawIds) ? rawIds : []).map(Number))];
    if (ids.length === 0 || ids.length > MAX_TRASH_IDS || !ids.every((id) => Number.isInteger(id) && id > 0)) {
        return { error: `Select between 1 and ${MAX_TRASH_IDS} media`, status: 400 };
    }
    return { ids };
};

const forbidAdmin = (user) => (user.type === "admin" ? { error: "The trash is only available for library accounts", status: 403 } : null);

const withExpiry = (media) => {
    const expiresAt = new Date(new Date(media.deleted_at).getTime() + TRASH_RETENTION_DAYS * DAY_MS);
    return { ...media, expires_at: expiresAt, days_left: Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS)) };
};

class TrashService {
    static async getAll(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const rows = await MediaModel.findTrashByUserId(user.id);
        const media = await MediaService.enrichMediaListWithTags(rows);
        return { data: { retentionDays: TRASH_RETENTION_DAYS, media: media.map(withExpiry) } };
    }

    static async restore(body, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        const { ids, ...idsError } = parseIds(body?.ids);
        if (!ids) return idsError;

        // Solo las que estaban en la papelera disparan las reglas de "Media restored".
        const trashedIds = (await MediaModel.findTrashedForUser(user.id, ids)).map((media) => media.id);
        const restoredCount = await MediaModel.restoreFromTrash(trashedIds, user.id);
        if (restoredCount > 0) {
            await RuleEngineService.runForEvent(user.id, "restored", trashedIds);
            await AuditService.logEvent({ actionCode: "MEDIA_RESTORE", req, statusCode: 200, message: `Restored ${restoredCount} media from trash`, metadata: { ids } });
        }
        return { data: { restoredCount } };
    }

    // Borra definitivamente medias de la papelera: la fila (con sus tags y álbumes), sus archivos y las
    // portadas de álbum que las usaban. En las de Drive solo se borra la caché: el original sigue en Drive.
    static async purgeMedia(mediaList) {
        if (mediaList.length === 0) return 0;
        const deletedCount = await MediaModel.deleteMany(mediaList.map((media) => media.id));
        await Promise.all(mediaList.map(removeStoredMediaFiles));

        const coverPathsByUser = new Map();
        mediaList.forEach((media) => {
            const paths = coverPathsByUser.get(media.user_id) || [];
            paths.push(...[media.previewpath, media.filepath].filter(Boolean));
            coverPathsByUser.set(media.user_id, paths);
        });
        await Promise.all([...coverPathsByUser].map(([userId, paths]) => AlbumModel.clearCoverPaths(userId, paths)));
        return deletedCount;
    }

    static async deleteForever(body, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        // Sin ids: vaciar la papelera entera.
        const emptyAll = body?.all === true;
        let ids = null;
        if (!emptyAll) {
            const parsed = parseIds(body?.ids);
            if (!parsed.ids) return parsed;
            ids = parsed.ids;
        }

        const mediaList = await MediaModel.findTrashedForUser(user.id, ids);
        const deletedCount = await this.purgeMedia(mediaList);
        if (deletedCount > 0) {
            await AuditService.logEvent({
                actionCode: "MEDIA_PURGE",
                req,
                statusCode: 200,
                message: emptyAll ? `Emptied trash (${deletedCount} media)` : `Deleted ${deletedCount} media forever`,
                metadata: { ids: mediaList.map((media) => media.id) },
            });
        }
        return { data: { deletedCount } };
    }

    // Borra definitivamente lo que lleva más de TRASH_RETENTION_DAYS días en la papelera, de todos los usuarios.
    static async purgeExpired() {
        let totalDeleted = 0;
        for (;;) {
            const expired = await MediaModel.findExpiredTrash(TRASH_RETENTION_DAYS, PURGE_BATCH_SIZE);
            if (expired.length === 0) break;
            totalDeleted += await this.purgeMedia(expired);
            if (expired.length < PURGE_BATCH_SIZE) break;
        }
        if (totalDeleted > 0) console.log(`🗑️  Purged ${totalDeleted} media that spent ${TRASH_RETENTION_DAYS} days in the trash`);
        return totalDeleted;
    }

    // Purga al arrancar y después cada hora. Un fallo se registra y se reintenta en la siguiente vuelta.
    static startPurgeSchedule() {
        const run = () => this.purgeExpired().catch((error) => console.error("Trash purge failed:", error));
        run();
        return setInterval(run, PURGE_INTERVAL_MS).unref();
    }
}

module.exports = TrashService;
