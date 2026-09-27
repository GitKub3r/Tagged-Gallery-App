const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const bcrypt = require("bcrypt");
const DemoModel = require("../models/Demo.model");
const UserModel = require("../models/User.model");
const AuditService = require("./Audit.service");
const TrashService = require("./Trash.service");
const { MEDIA, TAGS, ALBUMS, TEMPLATES, RULES } = require("../demo/demoContent");
const { ensureDemoAssets, getAssetPath, hashKey, MIME_TYPES, EXTENSIONS } = require("../demo/demoAssets");
const { computeFileMd5, generateMediaDerivatives, removeMediaDerivatives } = require("../utils/media");
const { MEDIA_UPLOAD_DIR, ensureUploadDirs } = require("../middlewares/upload.middleware");
const { sanitizeGraph } = require("../utils/ruleGraph");
const { parseUtcOffset } = require("../utils/utcOffset");

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const SEED_CONCURRENCY = 4;

const onlyAdmins = (user) => (user.type === "admin" ? null : { error: "Demo mode is only available for admin accounts", status: 403 });

// Hora del día del admin (utcOffset: minutos respecto a UTC) dayShift días después de hoy. Las fechas de la demo
// se calculan en su zona horaria, no en la del servidor: "se borra hoy" tiene que ser hoy para quien la mira.
const atLocalTime = (now, utcOffset, dayShift, hours, minutes = 0) => {
    const local = new Date(now.getTime() + utcOffset * MINUTE_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayShift, hours, minutes) - utcOffset * MINUTE_MS);
};

// Fecha de subida: el día indicado a una hora que depende de la media, nunca en el futuro.
const uploadDate = (now, utcOffset, daysAgo, key) => {
    const hash = hashKey(key);
    const date = atLocalTime(now, utcOffset, -daysAgo, 9 + (hash % 13), hash % 60);
    return date.getTime() < now.getTime() - 5 * MINUTE_MS ? date : new Date(now.getTime() - (5 + (hash % 50)) * MINUTE_MS);
};

// Fecha de borrado para que queden "trash" días de papelera: se borra ese día por la noche (hora del admin).
const trashDate = (now, utcOffset, daysLeft, createdAt) => {
    const expiresAt = new Date(Math.max(atLocalTime(now, utcOffset, daysLeft, 22).getTime(), now.getTime() + 30 * MINUTE_MS));
    const deletedAt = new Date(expiresAt.getTime() - TrashService.RETENTION_DAYS * DAY_MS);
    const latest = new Date(now.getTime() - 2 * MINUTE_MS);
    const earliest = new Date(createdAt.getTime() + 60 * MINUTE_MS);
    return new Date(Math.max(Math.min(deletedAt.getTime(), latest.getTime()), earliest.getTime()));
};

const runInBatches = async (items, task) => {
    const queue = [...items];
    const results = new Map();
    await Promise.all(
        Array.from({ length: SEED_CONCURRENCY }, async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                results.set(item, await task(item));
            }
        }),
    );
    return results;
};

// Una tarea por admin a la vez: activar dos veces seguidas o activar y resetear no crean dos bibliotecas.
const pendingByOwner = new Map();
const runExclusive = async (ownerId, task) => {
    while (pendingByOwner.has(ownerId)) await pendingByOwner.get(ownerId).catch(() => null);
    const pending = task();
    pendingByOwner.set(ownerId, pending);
    try {
        return await pending;
    } finally {
        pendingByOwner.delete(ownerId);
    }
};

class DemoService {
    // Copia el archivo de la media desde la caché y genera su miniatura con el mismo proceso que una subida.
    static async prepareMedia(libraryId, item, now, utcOffset, writtenFiles) {
        const createdAt = uploadDate(now, utcOffset, item.daysAgo, item.key);
        const deletedAt = item.trash === undefined ? null : trashDate(now, utcOffset, item.trash, createdAt);
        const kind = item.asset.kind;
        const filename = `${createdAt.getTime()}-${Math.round(Math.random() * 1e9)}${EXTENSIONS[kind]}`;
        const filePath = path.join(MEDIA_UPLOAD_DIR, filename);

        writtenFiles.push(filename);
        await fs.copyFile(getAssetPath({ id: item.key, kind }), filePath);
        const derivatives = await generateMediaDerivatives({ path: filePath, filename, originalname: filename, mimetype: MIME_TYPES[kind] }, kind === "video" ? "video" : "image");
        const { size } = await fs.stat(filePath);

        const media = {
            user_id: libraryId,
            displayname: item.name,
            author: item.author,
            filename,
            size,
            width: derivatives.width,
            height: derivatives.height,
            filepath: `/uploads/media/${filename}`,
            thumbpath: derivatives.thumbnailPath,
            previewpath: derivatives.previewPath,
            mediatype: kind,
            is_favourite: Boolean(item.favourite),
            checksum_md5: await computeFileMd5(filePath),
            created_at: createdAt,
            updated_at: deletedAt || createdAt,
            deleted_at: deletedAt,
            was_trashed: Boolean(deletedAt || item.wasTrashed),
        };
        return media;
    }

    static async seedLibrary(libraryId, utcOffset, writtenFiles) {
        const now = new Date();
        const daysAgo = (days) => new Date(now.getTime() - days * DAY_MS);

        const tagIds = await DemoModel.insertTags(libraryId, TAGS);
        const prepared = await runInBatches(MEDIA, (item) => this.prepareMedia(libraryId, item, now, utcOffset, writtenFiles));
        // Se guardan por fecha de subida: la galería ordena por id, como si se hubieran ido subiendo con el tiempo.
        const mediaByKey = new Map();
        for (const item of [...MEDIA].sort((a, b) => prepared.get(a).created_at - prepared.get(b).created_at)) {
            const media = prepared.get(item);
            mediaByKey.set(item.key, { ...media, id: await DemoModel.insertMedia(media) });
        }

        await DemoModel.insertMediaTags(MEDIA.flatMap((item) => item.tags.map((tag) => [tagIds.get(tag), mediaByKey.get(item.key).id])));

        const albumIds = new Map();
        for (const album of ALBUMS) {
            const cover = album.cover ? mediaByKey.get(album.cover) : null;
            const albumId = await DemoModel.insertAlbum(libraryId, {
                name: album.name,
                coverpath: cover ? cover.previewpath || cover.filepath : null,
                thumbpath: cover ? cover.thumbpath : null,
                createdAt: daysAgo(album.daysAgo),
            });
            albumIds.set(album.name, albumId);
            await DemoModel.insertAlbumMedia(albumId, album.media.map((key) => mediaByKey.get(key).id));
        }

        for (const template of TEMPLATES) {
            await DemoModel.insertTemplate(libraryId, { ...template, markFavourite: Boolean(template.markFavourite), createdAt: daysAgo(template.daysAgo) });
        }

        for (const rule of RULES) {
            // Los álbumes van por nombre en el contenido; un álbum que no existe deja la acción sin configurar.
            const nodes = rule.graph.nodes.map(({ config, ...ruleNode }) => {
                if (!("album" in config)) return { ...ruleNode, config };
                const { album, ...rest } = config;
                return { ...ruleNode, config: { ...rest, albumId: albumIds.get(album) ?? null } };
            });
            const { data: graph, error } = sanitizeGraph({ nodes, edges: rule.graph.edges });
            if (error) throw new Error(`Invalid demo rule "${rule.name}": ${error}`);
            await DemoModel.insertRule(libraryId, {
                name: rule.name,
                isActive: rule.isActive,
                graph,
                appliedCount: rule.applied?.count ?? 0,
                lastAppliedAt: rule.applied ? daysAgo(rule.applied.daysAgo) : null,
                createdAt: daysAgo(rule.daysAgo),
            });
        }
    }

    static async createLibrary(ownerId, utcOffset) {
        ensureUploadDirs();
        await ensureDemoAssets();
        const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
        const libraryId = await DemoModel.createLibraryUser(ownerId, {
            username: `demo-library-${ownerId}`,
            email: `demo-library-${ownerId}@demo.tagged`,
            password,
        });
        const writtenFiles = [];
        try {
            await this.seedLibrary(libraryId, utcOffset, writtenFiles);
        } catch (error) {
            await this.removeLibrary(ownerId);
            // Archivos copiados cuya fila no llegó a guardarse.
            await Promise.all(writtenFiles.map((filename) => Promise.all([fs.rm(path.join(MEDIA_UPLOAD_DIR, filename), { force: true }), removeMediaDerivatives(filename)])));
            throw error;
        }
    }

    // Borra la biblioteca demo de un admin: primero los archivos de sus medias y después la cuenta, con todo su
    // contenido en cascada (tags, álbumes, plantillas, reglas y cualquier tabla futura ligada a users).
    static async removeLibrary(ownerId) {
        const library = await DemoModel.findLibraryUser(ownerId);
        if (!library) return;
        await TrashService.purgeMedia(await DemoModel.findMediaForPurge(library.id));
        await DemoModel.deleteLibraryUser(library.id);
    }

    static async buildStatus(ownerId) {
        const [owner, library] = await Promise.all([UserModel.findById(ownerId), DemoModel.findLibraryUser(ownerId)]);
        return {
            enabled: Boolean(owner?.demo_mode && library),
            ready: Boolean(library),
            summary: library ? await DemoModel.getSummary(library.id) : null,
        };
    }

    static async getStatus(user) {
        return onlyAdmins(user) || { data: await this.buildStatus(user.id) };
    }

    // La primera vez crea la biblioteca demo (generar los archivos puede tardar hasta un minuto).
    static async setEnabled(user, { enabled, utcOffset }, req) {
        const forbidden = onlyAdmins(user);
        if (forbidden) return forbidden;
        if (typeof enabled !== "boolean") return { error: "enabled must be a boolean", status: 400 };

        await runExclusive(user.id, async () => {
            if (enabled && !(await DemoModel.findLibraryUser(user.id))) await this.createLibrary(user.id, parseUtcOffset(utcOffset));
            await UserModel.setDemoMode(user.id, enabled);
        });
        await AuditService.logEvent({ actionCode: enabled ? "DEMO_MODE_ENABLE" : "DEMO_MODE_DISABLE", req, statusCode: 200, message: `Turned ${enabled ? "on" : "off"} demo mode` });
        return { data: await this.buildStatus(user.id) };
    }

    // Vuelve a crear la biblioteca demo desde cero: se pierde lo que se haya cambiado en ella.
    static async reset(user, { utcOffset }, req) {
        const forbidden = onlyAdmins(user);
        if (forbidden) return forbidden;

        await runExclusive(user.id, async () => {
            await this.removeLibrary(user.id);
            await this.createLibrary(user.id, parseUtcOffset(utcOffset));
        });
        await AuditService.logEvent({ actionCode: "DEMO_MODE_RESET", req, statusCode: 200, message: "Reset the demo library" });
        return { data: await this.buildStatus(user.id) };
    }
}

module.exports = DemoService;
