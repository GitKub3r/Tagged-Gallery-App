const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { drive: createDriveApi } = require("@googleapis/drive");
const { OAuth2Client } = require("google-auth-library");
const GoogleDriveConnectionModel = require("../models/GoogleDriveConnection.model");
const MediaModel = require("../models/Media.model");
const AuditService = require("./Audit.service");
const MediaService = require("./Media.service");
const { encrypt, decrypt, hasEncryptionKey } = require("../utils/crypto");
const { detectMediaType, getDriveDerivedFilename, writeJpeg, THUMBNAIL_OPTIONS, PREVIEW_OPTIONS } = require("../utils/media");
const { THUMBNAILS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR, DRIVE_CACHE_DIR } = require("../middlewares/upload.middleware");
const { signDriveThumbnail } = require("../utils/uploadUrls");

// Permiso de solo lectura sobre todo el Drive: lo necesita el explorador de Tagged para listar carpetas.
// Es un permiso restringido: sin la verificación de Google, la app funciona en modo Prueba (usuarios de prueba).
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const OAUTH_SCOPES = [DRIVE_READONLY_SCOPE, "openid", "email"];

const isConfigured = () =>
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) && hasEncryptionKey();

// Con el flujo de código en ventana emergente de Google Identity Services, el redirect_uri es "postmessage".
const createOAuthClient = () =>
    new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, "postmessage");

const MAX_LINK_FILES = 50;
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const DRIVE_FILE_FIELDS = "id, name, mimeType, size, md5Checksum, modifiedTime, thumbnailLink, trashed";
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

const isSupportedDriveMimeType = (mimeType = "") => mimeType.startsWith("image/") || mimeType.startsWith("video/");

const isRevokedGrantError = (error) =>
    error?.response?.data?.error === "invalid_grant" || String(error?.message || "").includes("invalid_grant");

const getGoogleErrorStatus = (error) => Number(error?.response?.status || error?.code) || null;

// thumbnailLink termina en "=s220"; se pide el tamaño que necesitamos.
const resizeThumbnailLink = (link, size) => (/=s\d+$/.test(link) ? link.replace(/=s\d+$/, `=s${size}`) : `${link}=s${size}`);

const PREVIEW_SIZE = 1280;
const LINK_CONCURRENCY = 4;
const RECENT_DRIVE_MEDIA_LIMIT = 6;
// Máximo de archivos que se añaden de una vez al expandir las carpetas elegidas.
const MAX_FOLDER_EXPANSION = 500;
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const PREVIEW_CONCURRENCY = 6;

// Explorador de Drive propio (requiere drive.readonly).
const BROWSE_PAGE_SIZE = 60;
const BROWSE_VIEWS = new Set(["my-drive", "recent", "starred", "shared"]);
const MAX_BROWSE_SEARCH_LENGTH = 100;
const BROWSE_THUMBNAIL_SIZE = 480;
const BROWSE_THUMBNAIL_MAX_AGE_DAYS = 30;
const MEDIA_QUERY = "(mimeType contains 'image/' or mimeType contains 'video/')";
const FOLDER_OR_MEDIA_QUERY = `(mimeType = '${DRIVE_FOLDER_MIME_TYPE}' or ${MEDIA_QUERY.slice(1, -1)})`;
const BROWSE_FIELDS =
    "nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, videoMediaMetadata(durationMillis))";

// Comillas y barras escapadas para la sintaxis de consultas de Drive.
const escapeDriveQuery = (value) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const hasReadonlyScope = (connection) => String(connection?.scopes || "").split(" ").includes(DRIVE_READONLY_SCOPE);

// Consulta y orden de files.list según la vista, la carpeta abierta y la búsqueda.
const buildBrowseQuery = ({ view, folderId, search }) => {
    const base = "trashed = false";
    if (search) {
        const scope = view === "starred" ? " and starred = true" : view === "shared" ? " and sharedWithMe = true" : "";
        const types = view === "recent" ? MEDIA_QUERY : FOLDER_OR_MEDIA_QUERY;
        return { q: `${base} and name contains '${escapeDriveQuery(search)}' and ${types}${scope}`, orderBy: "folder, modifiedTime desc" };
    }
    if (folderId) return { q: `${base} and '${folderId}' in parents and ${FOLDER_OR_MEDIA_QUERY}`, orderBy: "folder, name" };
    if (view === "recent") return { q: `${base} and ${MEDIA_QUERY}`, orderBy: "modifiedTime desc" };
    if (view === "starred") return { q: `${base} and starred = true and ${FOLDER_OR_MEDIA_QUERY}`, orderBy: "folder, modifiedTime desc" };
    if (view === "shared") return { q: `${base} and sharedWithMe = true and ${FOLDER_OR_MEDIA_QUERY}`, orderBy: "folder, modifiedTime desc" };
    return { q: `${base} and 'root' in parents and ${FOLDER_OR_MEDIA_QUERY}`, orderBy: "folder, name" };
};

const getBrowseThumbnailPath = (userId, fileId, version) => path.join(DRIVE_CACHE_DIR, `${userId}-${fileId}-${version}.jpg`);

// Clientes OAuth por usuario: reutilizarlos evita renovar el access token en cada petición
// (el explorador pide muchas miniaturas seguidas). Se descartan si cambia el refresh token guardado.
const authorizedClients = new Map();
// Miniaturas que se están descargando, para no pedir la misma dos veces a la vez.
const pendingThumbnails = new Map();

const parseFileIds = (rawFileIds) => {
    const fileIds = [...new Set(Array.isArray(rawFileIds) ? rawFileIds : [])];
    if (fileIds.length === 0 || fileIds.length > MAX_LINK_FILES) {
        return { error: `Select between 1 and ${MAX_LINK_FILES} Drive files`, status: 400 };
    }
    if (!fileIds.every((fileId) => typeof fileId === "string" && DRIVE_FILE_ID_PATTERN.test(fileId))) {
        return { error: "Invalid Drive file id", status: 400 };
    }
    return { fileIds };
};

// Resolución original del archivo según Drive (las fotos giradas 90° o 270° intercambian ancho y alto).
const getDriveFileDimensions = (driveFile) => {
    const media = driveFile.imageMediaMetadata || driveFile.videoMediaMetadata;
    if (!media?.width || !media?.height) return null;
    const isRotated = driveFile.imageMediaMetadata?.rotation === 1 || driveFile.imageMediaMetadata?.rotation === 3;
    return isRotated ? { width: media.height, height: media.width } : { width: media.width, height: media.height };
};

// Ejecuta fn sobre items con un máximo de peticiones simultáneas a Google.
const mapWithConcurrency = async (items, limit, fn) => {
    const results = new Array(items.length);
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await fn(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
};

const forbidAdmin = (user) =>
    user.type === "admin" ? { error: "Google Drive is only available for library accounts", status: 403 } : null;

const notConfigured = () => ({ error: "Google Drive integration is not configured on the server", status: 503 });

const toStatus = (connection) => ({
    configured: true,
    // Datos públicos que el cliente necesita para Google Identity Services.
    config: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        scopes: OAUTH_SCOPES,
    },
    connected: Boolean(connection && connection.status === "connected"),
    // Conexiones antiguas hechas solo con drive.file: hay que volver a conectar para explorar el Drive.
    needsReconnect: Boolean(connection && connection.status === "connected" && !hasReadonlyScope(connection)),
    status: connection?.status || "disconnected",
    email: connection?.google_account_email || null,
    connectedAt: connection?.updated_at || null,
});

class GoogleDriveService {
    // Cliente OAuth con el refresh token del usuario. El access token se renueva solo cuando caduca.
    static async getAuthorizedClient(userId) {
        if (!isConfigured()) return notConfigured();

        const connection = await GoogleDriveConnectionModel.findByUserId(userId);
        if (!connection || connection.status !== "connected") {
            return { error: "Google Drive is not connected", status: 409 };
        }

        const cached = authorizedClients.get(userId);
        if (cached?.refreshTokenEncrypted === connection.refresh_token_encrypted) return { client: cached.client, connection };

        const client = createOAuthClient();
        client.setCredentials({ refresh_token: decrypt(connection.refresh_token_encrypted) });
        authorizedClients.set(userId, { client, refreshTokenEncrypted: connection.refresh_token_encrypted });
        return { client, connection };
    }

    // Si Google invalida el acceso (el usuario lo revocó desde su cuenta), la conexión y sus medias pasan a "revoked".
    static async handleRevokedGrant(error, userId) {
        if (!isRevokedGrantError(error)) return null;
        authorizedClients.delete(userId);
        await GoogleDriveConnectionModel.updateStatus(userId, "revoked");
        await GoogleDriveConnectionModel.markUserMediaStatus(userId, "revoked");
        return { error: "Google Drive access was revoked. Please reconnect your account.", status: 409 };
    }

    // Descarga la miniatura que Drive ya genera y la guarda como JPEG local (no se descarga el original).
    static async cacheDerivative(client, thumbnailLink, size, outputFilePath, resizeOptions, quality) {
        const response = await client.request({ url: resizeThumbnailLink(thumbnailLink, size), responseType: "arraybuffer" });
        await writeJpeg(Buffer.from(response.data), outputFilePath, resizeOptions, quality);
    }

    static async cacheDriveDerivatives(client, driveFile, userId) {
        const derivedFilename = getDriveDerivedFilename(userId, driveFile.id);
        const derivatives = { thumbpath: null, previewpath: null };
        if (!driveFile.thumbnailLink) return derivatives;

        try {
            await this.cacheDerivative(client, driveFile.thumbnailLink, 640, path.join(THUMBNAILS_UPLOAD_DIR, derivedFilename), THUMBNAIL_OPTIONS, 72);
            derivatives.thumbpath = `/uploads/thumbnails/${derivedFilename}`;

            // Los navegadores no muestran HEIC: se guarda un preview grande generado por Drive.
            if (HEIC_MIME_TYPES.has(driveFile.mimeType)) {
                await this.cacheDerivative(client, driveFile.thumbnailLink, 2560, path.join(PREVIEWS_UPLOAD_DIR, derivedFilename), PREVIEW_OPTIONS, 85);
                derivatives.previewpath = `/uploads/previews/${derivedFilename}`;
            }
        } catch (error) {
            // Drive puede tardar en generar la miniatura de un vídeo recién subido; la media se vincula igualmente.
            console.warn(`Could not cache Drive thumbnail for ${driveFile.id}:`, error.message);
        }

        return derivatives;
    }

    // Vistas previas de los archivos elegidos para el modal de revisión. Se devuelven como data URL y no se guardan.
    static async getPreviews(body, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const { fileIds, ...fileIdsError } = parseFileIds(body?.fileIds);
        if (!fileIds) return fileIdsError;

        const { client, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;
        const driveApi = createDriveApi({ version: "v3", auth: client });

        try {
            const previews = await mapWithConcurrency(fileIds, PREVIEW_CONCURRENCY, async (fileId) => {
                let driveFile;
                try {
                    ({ data: driveFile } = await driveApi.files.get({
                        fileId,
                        fields: "id, name, mimeType, size, thumbnailLink, imageMediaMetadata(width, height, rotation), videoMediaMetadata(width, height)",
                        supportsAllDrives: true,
                    }));
                } catch (error) {
                    if (isRevokedGrantError(error)) throw error;
                    return { id: fileId, thumbnail: null };
                }

                let thumbnail = null;
                if (driveFile.thumbnailLink) {
                    try {
                        const response = await client.request({ url: resizeThumbnailLink(driveFile.thumbnailLink, PREVIEW_SIZE), responseType: "arraybuffer" });
                        const jpeg = await sharp(Buffer.from(response.data), { failOn: "none" })
                            .rotate()
                            .resize({ width: PREVIEW_SIZE, height: PREVIEW_SIZE, fit: "inside", withoutEnlargement: true })
                            .jpeg({ quality: 78, mozjpeg: true })
                            .toBuffer();
                        thumbnail = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
                    } catch (error) {
                        console.warn(`Could not load Drive preview for ${fileId}:`, error.message);
                    }
                }

                return {
                    id: driveFile.id,
                    name: driveFile.name,
                    mimeType: driveFile.mimeType,
                    size: Number(driveFile.size) || 0,
                    dimensions: getDriveFileDimensions(driveFile),
                    thumbnail,
                };
            });
            return { data: previews };
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            throw error;
        }
    }

    static async getSummary(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const [stats, recentRows] = await Promise.all([
            MediaModel.getDriveSummary(user.id),
            MediaModel.findRecentDriveMedia(user.id, RECENT_DRIVE_MEDIA_LIMIT),
        ]);
        return { data: { ...stats, recent: await MediaService.enrichMediaListWithTags(recentRows) } };
    }

    // Lista una página del Drive del usuario para el explorador de Tagged: una carpeta, una vista
    // (recientes, destacados, compartidos) o una búsqueda. Marca los archivos que ya están en la biblioteca.
    static async browse(query, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const view = BROWSE_VIEWS.has(query?.view) ? query.view : "my-drive";
        const folderId = typeof query?.folderId === "string" && query.folderId ? query.folderId : null;
        if (folderId && folderId !== "root" && !DRIVE_FILE_ID_PATTERN.test(folderId)) return { error: "Invalid Drive folder id", status: 400 };
        const search = typeof query?.search === "string" ? query.search.trim().slice(0, MAX_BROWSE_SEARCH_LENGTH) : "";
        const pageToken = typeof query?.pageToken === "string" && query.pageToken ? query.pageToken : undefined;

        const { client, connection, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;
        if (!hasReadonlyScope(connection)) {
            return { error: "Browsing your Drive needs read-only access. Reconnect Google Drive and try again.", status: 409 };
        }
        const driveApi = createDriveApi({ version: "v3", auth: client });

        let data;
        try {
            ({ data } = await driveApi.files.list({
                ...buildBrowseQuery({ view, folderId, search }),
                fields: BROWSE_FIELDS,
                pageSize: BROWSE_PAGE_SIZE,
                pageToken,
                spaces: "drive",
            }));
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            if (getGoogleErrorStatus(error) === 404) return { error: "This Drive folder is not available", status: 404 };
            if (getGoogleErrorStatus(error) === 400 && pageToken) return { error: "This page of results expired. Reload the folder.", status: 400 };
            throw error;
        }

        const files = data.files || [];
        const linkedFileIds = await MediaModel.findLinkedDriveFileIds(user.id, files.map((file) => file.id));
        const items = files.map((file) => {
            const isFolder = file.mimeType === DRIVE_FOLDER_MIME_TYPE;
            const version = Date.parse(file.modifiedTime) || 0;
            return {
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                isFolder,
                size: Number(file.size) || 0,
                modifiedTime: file.modifiedTime || null,
                durationMs: Number(file.videoMediaMetadata?.durationMillis) || null,
                thumbnailUrl: !isFolder && file.thumbnailLink ? signDriveThumbnail(user.id, file.id, version) : null,
                inLibrary: linkedFileIds.has(file.id),
            };
        });

        return { data: { items, nextPageToken: data.nextPageToken || null } };
    }

    // Miniatura de un archivo del explorador. Se descarga de Drive la primera vez y se guarda en
    // uploads/drive-cache; la versión (fecha de modificación) forma parte del nombre.
    static async getBrowseThumbnail(userId, fileId, version) {
        if (!DRIVE_FILE_ID_PATTERN.test(fileId) || !/^\d{1,15}$/.test(String(version))) return { error: "Invalid thumbnail", status: 400 };

        // Se comprueba siempre la conexión: tras desconectar, las URLs ya emitidas dejan de servir miniaturas.
        const { client, ...clientError } = await this.getAuthorizedClient(userId);
        if (!client) return clientError;

        const filePath = getBrowseThumbnailPath(userId, fileId, version);
        try {
            await fs.access(filePath);
            return { data: { filePath } };
        } catch {
            // No está en caché: se descarga.
        }

        const key = `${userId}:${fileId}:${version}`;
        if (!pendingThumbnails.has(key)) {
            pendingThumbnails.set(key, this.downloadBrowseThumbnail(client, userId, fileId, filePath).finally(() => pendingThumbnails.delete(key)));
        }
        return pendingThumbnails.get(key);
    }

    static async downloadBrowseThumbnail(client, userId, fileId, filePath) {
        try {
            const driveApi = createDriveApi({ version: "v3", auth: client });
            const { data: driveFile } = await driveApi.files.get({ fileId, fields: "thumbnailLink", supportsAllDrives: true });
            if (!driveFile.thumbnailLink) return { error: "Thumbnail not available", status: 404 };

            const response = await client.request({ url: resizeThumbnailLink(driveFile.thumbnailLink, BROWSE_THUMBNAIL_SIZE), responseType: "arraybuffer" });
            // Se escribe en un temporal y se renombra, para no servir nunca un archivo a medias.
            const temporaryPath = `${filePath}.${process.pid}.tmp`;
            await writeJpeg(Buffer.from(response.data), temporaryPath, { width: BROWSE_THUMBNAIL_SIZE, height: BROWSE_THUMBNAIL_SIZE, fit: "inside", withoutEnlargement: true }, 72);
            await fs.rename(temporaryPath, filePath);
            return { data: { filePath } };
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, userId);
            if (revoked) return revoked;
            const status = getGoogleErrorStatus(error);
            if (status === 403 || status === 404) return { error: "Thumbnail not available", status: 404 };
            throw error;
        }
    }

    // Borra las miniaturas del explorador que llevan mucho tiempo sin renovarse.
    static async pruneBrowseThumbnails() {
        const limit = Date.now() - BROWSE_THUMBNAIL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        try {
            const entries = await fs.readdir(DRIVE_CACHE_DIR);
            await Promise.all(entries.map(async (entry) => {
                const entryPath = path.join(DRIVE_CACHE_DIR, entry);
                const stats = await fs.stat(entryPath);
                if (stats.mtimeMs < limit) await fs.unlink(entryPath);
            }));
        } catch (error) {
            console.warn("Could not prune Drive thumbnail cache:", error.message);
        }
    }

    // Convierte la selección del explorador (archivos y carpetas) en la lista de fotos y vídeos a añadir.
    // Las carpetas se recorren con sus subcarpetas y el total se limita a MAX_FOLDER_EXPANSION.
    static async expandSelection(body, user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const items = Array.isArray(body?.items) ? body.items : [];
        if (items.length === 0 || items.length > MAX_FOLDER_EXPANSION) {
            return { error: `Select between 1 and ${MAX_FOLDER_EXPANSION} Drive items`, status: 400 };
        }
        if (!items.every((item) => typeof item?.id === "string" && DRIVE_FILE_ID_PATTERN.test(item.id))) {
            return { error: "Invalid Drive file id", status: 400 };
        }

        const folderIds = items.filter((item) => item.mimeType === DRIVE_FOLDER_MIME_TYPE).map((item) => item.id);
        const connection = await GoogleDriveConnectionModel.findByUserId(user.id);
        if (folderIds.length > 0 && !hasReadonlyScope(connection)) {
            return { error: "Adding whole folders needs read-only access to your Drive. Reconnect Google Drive and try again.", status: 409 };
        }

        const { client, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;
        const driveApi = createDriveApi({ version: "v3", auth: client });

        const files = [];
        const seenFileIds = new Set();
        let truncated = false;
        const addFile = (file) => {
            if (seenFileIds.has(file.id) || !isSupportedDriveMimeType(file.mimeType)) return;
            if (files.length >= MAX_FOLDER_EXPANSION) {
                truncated = true;
                return;
            }
            seenFileIds.add(file.id);
            files.push({ id: file.id, name: file.name, mimeType: file.mimeType, sizeBytes: Number(file.size ?? file.sizeBytes) || 0 });
        };

        items.filter((item) => item.mimeType !== DRIVE_FOLDER_MIME_TYPE).forEach(addFile);

        const pendingFolders = [...folderIds];
        const visitedFolders = new Set();
        try {
            while (pendingFolders.length > 0 && !truncated) {
                const folderId = pendingFolders.shift();
                if (visitedFolders.has(folderId)) continue;
                visitedFolders.add(folderId);

                let pageToken;
                do {
                    const { data } = await driveApi.files.list({
                        q: `'${folderId}' in parents and trashed = false and (mimeType = '${DRIVE_FOLDER_MIME_TYPE}' or mimeType contains 'image/' or mimeType contains 'video/')`,
                        fields: "nextPageToken, files(id, name, mimeType, size)",
                        orderBy: "folder, name",
                        pageSize: 1000,
                        pageToken,
                        supportsAllDrives: true,
                        includeItemsFromAllDrives: true,
                    });
                    (data.files || []).forEach((file) => (file.mimeType === DRIVE_FOLDER_MIME_TYPE ? pendingFolders.push(file.id) : addFile(file)));
                    pageToken = data.nextPageToken;
                } while (pageToken && !truncated);
            }
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            throw error;
        }

        return { data: { files, truncated, limit: MAX_FOLDER_EXPANSION } };
    }

    // Vincula un archivo de Drive como media. Devuelve en qué grupo del resultado va (linked, duplicates...).
    static async linkSingleFile(fileId, { client, driveApi, user, body, isFavourite, tagNames, now }) {
        let driveFile;
        try {
            ({ data: driveFile } = await driveApi.files.get({ fileId, fields: DRIVE_FILE_FIELDS, supportsAllDrives: true }));
        } catch (error) {
            const status = getGoogleErrorStatus(error);
            if (!isRevokedGrantError(error) && (status === 403 || status === 404)) {
                return { type: "skipped", item: { fileId, reason: "not_accessible" } };
            }
            throw error;
        }

        if (driveFile.trashed || !isSupportedDriveMimeType(driveFile.mimeType)) {
            return { type: "skipped", item: { fileId, name: driveFile.name, reason: driveFile.trashed ? "trashed" : "unsupported_type" } };
        }

        // Si ya existe la misma media como archivo local, no se duplica.
        const [localDuplicate] = driveFile.md5Checksum ? await MediaModel.findLocalByChecksums(user.id, [driveFile.md5Checksum]) : [];
        if (localDuplicate) {
            return {
                type: "duplicates",
                item: {
                    driveFile: { id: driveFile.id, name: driveFile.name, mimeType: driveFile.mimeType, size: Number(driveFile.size) || 0 },
                    media: { id: localDuplicate.id, displayname: localDuplicate.displayname, thumbpath: localDuplicate.thumbpath },
                },
            };
        }

        const derivatives = await this.cacheDriveDerivatives(client, driveFile, user.id);
        let created;
        try {
            created = await MediaModel.create({
                user_id: user.id,
                displayname: MediaService.normalizeOptionalText(body.displayname),
                author: MediaService.normalizeOptionalText(body.author),
                filename: driveFile.name,
                size: Number(driveFile.size) || 0,
                // Ruta interna virtual: el original se sirve desde Drive, nunca desde el disco.
                filepath: `/uploads/drive/${user.id}-${driveFile.id}`,
                thumbpath: derivatives.thumbpath,
                previewpath: derivatives.previewpath,
                mediatype: detectMediaType(driveFile.mimeType, driveFile.name),
                is_favourite: isFavourite,
                checksum_md5: driveFile.md5Checksum || null,
                storage_provider: "google_drive",
                source_file_id: driveFile.id,
                source_mime_type: driveFile.mimeType,
                source_modified_time: driveFile.modifiedTime ? new Date(driveFile.modifiedTime) : null,
                last_synced_at: now,
            });
        } catch (error) {
            // Otra petición simultánea lo vinculó antes (índice único usuario + archivo de Drive).
            if (error.code === "ER_DUP_ENTRY") return { type: "alreadyLinked", item: { fileId } };
            throw error;
        }

        await MediaService.attachTagsToMedia(created.id, tagNames, user.id);
        return { type: "linked", item: { id: created.id, name: driveFile.name } };
    }

    static async linkFiles(body, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const { fileIds, ...fileIdsError } = parseFileIds(body?.fileIds);
        if (!fileIds) return fileIdsError;

        const validation = MediaService.validateCommonFields(body);
        if (!validation.success) return { error: validation.message, status: 400 };
        const parsedTagNames = MediaService.parseTagNames(body.tag_names);
        if (!parsedTagNames.success) return { error: parsedTagNames.message, status: 400 };

        const { client, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;
        const driveApi = createDriveApi({ version: "v3", auth: client });

        const result = { linked: [], alreadyLinked: [], duplicates: [], skipped: [] };
        const linkedFileIds = await MediaModel.findLinkedDriveFileIds(user.id, fileIds);
        const context = { client, driveApi, user, body, isFavourite: validation.isFavourite, tagNames: parsedTagNames.data, now: new Date() };

        try {
            const outcomes = await mapWithConcurrency(fileIds, LINK_CONCURRENCY, (fileId) =>
                linkedFileIds.has(fileId) ? { type: "alreadyLinked", item: { fileId } } : this.linkSingleFile(fileId, context),
            );
            outcomes.forEach(({ type, item }) => result[type].push(item));
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            throw error;
        }

        if (result.linked.length > 0) {
            await AuditService.logEvent({
                actionCode: "GOOGLE_DRIVE_LINK",
                req,
                statusCode: 201,
                message: `Linked ${result.linked.length} Google Drive file(s)`,
                metadata: { mediaIds: result.linked.map((item) => item.id) },
            });
        }

        return { data: result };
    }

    static async getStatus(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (!isConfigured()) return { data: { configured: false, connected: false, status: "disconnected" } };

        return { data: toStatus(await GoogleDriveConnectionModel.findByUserId(user.id)) };
    }

    static async connect(code, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (!isConfigured()) return notConfigured();
        if (typeof code !== "string" || !code.trim()) return { error: "Authorization code is required", status: 400 };

        const client = createOAuthClient();
        let tokens;
        try {
            ({ tokens } = await client.getToken(code.trim()));
        } catch (error) {
            console.error("Google Drive code exchange failed:", error.response?.data || error.message);
            return { error: "Google rejected the authorization. Please try connecting again.", status: 400 };
        }

        const grantedScopes = String(tokens.scope || "").split(" ");
        if (!grantedScopes.includes(DRIVE_READONLY_SCOPE)) {
            return { error: "Tagged needs access to your Google Drive. Please allow it and try again.", status: 400 };
        }

        let refreshToken = tokens.refresh_token;
        if (!refreshToken) {
            // Al reconectar, Google puede no emitir un refresh token nuevo. Se reutiliza el guardado si ya cubre
            // el permiso; si no, se revoca para que el siguiente intento muestre el consentimiento completo.
            refreshToken = await this.reuseStoredRefreshToken(user.id);
            if (!refreshToken) {
                return { error: "Google did not grant offline access. Please connect again.", status: 400 };
            }
        }

        let email = null;
        if (tokens.id_token) {
            const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
            email = ticket.getPayload()?.email || null;
        }

        const connection = await GoogleDriveConnectionModel.upsert({
            userId: user.id,
            email,
            refreshTokenEncrypted: encrypt(refreshToken),
            scopes: grantedScopes.join(" "),
        });
        // Al reconectar, las medias de Drive vuelven a estar accesibles; la comprobación de estado corregirá las que falten.
        await GoogleDriveConnectionModel.markUserMediaStatus(user.id, "available");
        await AuditService.logEvent({ actionCode: "GOOGLE_DRIVE_CONNECT", req, statusCode: 200, message: "Google Drive connected" });

        return { data: toStatus(connection) };
    }

    static async reuseStoredRefreshToken(userId) {
        const connection = await GoogleDriveConnectionModel.findByUserId(userId);
        if (!connection) return null;

        const client = createOAuthClient();
        const storedRefreshToken = decrypt(connection.refresh_token_encrypted);
        try {
            client.setCredentials({ refresh_token: storedRefreshToken });
            const { token } = await client.getAccessToken();
            const { scopes = [] } = await client.getTokenInfo(token);
            if (scopes.includes(DRIVE_READONLY_SCOPE)) return storedRefreshToken;
            await client.revokeToken(storedRefreshToken);
        } catch (error) {
            console.warn("Could not reuse stored Google Drive token:", error.response?.data || error.message);
        }
        return null;
    }

    static async disconnect(user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const connection = await GoogleDriveConnectionModel.findByUserId(user.id);
        if (!connection) return { error: "Google Drive is not connected", status: 404 };

        try {
            await createOAuthClient().revokeToken(decrypt(connection.refresh_token_encrypted));
        } catch (error) {
            // El token puede estar ya revocado desde la cuenta de Google; la desconexión local sigue adelante.
            console.warn("Google Drive token revocation failed:", error.response?.data || error.message);
        }

        authorizedClients.delete(user.id);
        await GoogleDriveConnectionModel.deleteByUserId(user.id);
        await GoogleDriveConnectionModel.markUserMediaStatus(user.id, "revoked");
        await AuditService.logEvent({ actionCode: "GOOGLE_DRIVE_DISCONNECT", req, statusCode: 200, message: "Google Drive disconnected" });

        return { data: isConfigured() ? toStatus(null) : { configured: false, connected: false, status: "disconnected" } };
    }
}

module.exports = GoogleDriveService;
