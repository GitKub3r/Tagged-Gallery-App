const fs = require("fs/promises");
const { createWriteStream } = require("fs");
const { pipeline } = require("stream/promises");
const http = require("http");
const path = require("path");
const sharp = require("sharp");
const { drive: createDriveApi } = require("@googleapis/drive");
const { OAuth2Client } = require("google-auth-library");
const GoogleDriveConnectionModel = require("../models/GoogleDriveConnection.model");
const MediaModel = require("../models/Media.model");
const AlbumModel = require("../models/Album.model");
const MediaTagModel = require("../models/MediaTag.model");
const AuditService = require("./Audit.service");
const MediaService = require("./Media.service");
const { encrypt, decrypt, hasEncryptionKey } = require("../utils/crypto");
const {
    computeFileMd5,
    detectMediaType,
    extractRemoteVideoFrame,
    generateMediaDerivatives,
    getDriveDerivedFilename,
    removeMediaDerivatives,
    removeStoredMediaFiles,
    writeJpeg,
    THUMBNAIL_OPTIONS,
    PREVIEW_OPTIONS,
} = require("../utils/media");
const { MEDIA_UPLOAD_DIR, THUMBNAILS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR, DRIVE_CACHE_DIR } = require("../middlewares/upload.middleware");
const { signDriveThumbnail } = require("../utils/uploadUrls");
const { DRIVE_TAG_NAME, withDriveTag } = require("../utils/driveTag");

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
// Medias por petición al importar (cada una descarga el original completo).
const MAX_IMPORT_MEDIA = 10;
// "Add all": máximo de fotos y vídeos que se revisan de una vez en "Mi unidad".
const MAX_LINK_ALL_SCAN = 10000;
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
// Filtro de tipo del explorador: fotos, vídeos o ambos. Las carpetas se muestran siempre.
const BROWSE_MEDIA_TYPES = new Set(["all", "image", "video"]);
const getMediaQuery = (mediaType) => (mediaType === "image" ? "mimeType contains 'image/'" : mediaType === "video" ? "mimeType contains 'video/'" : MEDIA_QUERY.slice(1, -1));
const getFolderOrMediaQuery = (mediaType) => `(mimeType = '${DRIVE_FOLDER_MIME_TYPE}' or ${getMediaQuery(mediaType)})`;
const BROWSE_FIELDS =
    "nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, parents, videoMediaMetadata(durationMillis))";
// Recent y la búsqueda de My Drive se quedan con lo que cuelga de "Mi unidad": files.list también devuelve las
// copias de seguridad de ordenadores (Drive para escritorio), que suelen incluir cachés y archivos de programas.
const MY_DRIVE_ONLY_VIEWS = new Set(["my-drive", "recent"]);
// Si el filtro deja una página vacía se leen más, hasta este máximo (Drive tarda más cuanto mayor es la página).
const MAX_FILTERED_PAGE_READS = 5;
const FOLDER_CACHE_TTL_MS = 60 * 60 * 1000;

// Comillas y barras escapadas para la sintaxis de consultas de Drive.
const escapeDriveQuery = (value) => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const hasReadonlyScope = (connection) => String(connection?.scopes || "").split(" ").includes(DRIVE_READONLY_SCOPE);

// Consulta y orden de files.list según la vista, la carpeta abierta y la búsqueda.
const buildBrowseQuery = ({ view, folderId, search, mediaType }) => {
    const mediaQuery = `(${getMediaQuery(mediaType)})`;
    const folderOrMediaQuery = getFolderOrMediaQuery(mediaType);
    const base = "trashed = false";
    if (search) {
        const scope = view === "starred" ? " and starred = true" : view === "shared" ? " and sharedWithMe = true" : "";
        const types = view === "recent" ? mediaQuery : folderOrMediaQuery;
        return { q: `${base} and name contains '${escapeDriveQuery(search)}' and ${types}${scope}`, orderBy: "folder, modifiedTime desc" };
    }
    if (folderId) return { q: `${base} and '${folderId}' in parents and ${folderOrMediaQuery}`, orderBy: "folder, name" };
    if (view === "recent") return { q: `${base} and ${mediaQuery}`, orderBy: "modifiedTime desc" };
    if (view === "starred") return { q: `${base} and starred = true and ${folderOrMediaQuery}`, orderBy: "folder, modifiedTime desc" };
    if (view === "shared") return { q: `${base} and sharedWithMe = true and ${folderOrMediaQuery}`, orderBy: "folder, modifiedTime desc" };
    return { q: `${base} and 'root' in parents and ${folderOrMediaQuery}`, orderBy: "folder, name" };
};

const getBrowseThumbnailPath = (userId, fileId, version) => path.join(DRIVE_CACHE_DIR, `${userId}-${fileId}-${version}.jpg`);

// Clientes OAuth por usuario: reutilizarlos evita renovar el access token en cada petición
// (el explorador pide muchas miniaturas seguidas). Se descartan si cambia el refresh token guardado.
const authorizedClients = new Map();
// Por usuario: id de "Mi unidad" y, por carpeta, si cuelga de ella (promesas, para compartir consultas en curso).
const myDriveFolderCache = new Map();
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

const PROXIED_RESPONSE_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"];

// Pide a Drive el contenido de un archivo reenviando la cabecera Range (vídeo con saltos, descargas parciales).
const requestDriveContent = (client, fileId, range) =>
    client.request({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        headers: range ? { Range: range } : {},
        responseType: "stream",
        validateStatus: () => true,
    });

const getProxiedHeaders = (upstream) => {
    const getHeader = (name) => (typeof upstream.headers?.get === "function" ? upstream.headers.get(name) : upstream.headers?.[name]);
    return Object.fromEntries(PROXIED_RESPONSE_HEADERS.map((name) => [name, getHeader(name)]).filter(([, value]) => value));
};

// Sirve un archivo de Drive en 127.0.0.1 mientras dura fn(url), reenviando las peticiones Range con la
// autorización del usuario. Lo usa ffmpeg, que no puede resolver dominios y así tampoco recibe el token.
const withLocalDriveStream = async (client, fileId, fn) => {
    const upstreams = new Set();
    const server = http.createServer(async (req, res) => {
        try {
            const upstream = await requestDriveContent(client, fileId, req.headers.range);
            upstreams.add(upstream.data);
            res.writeHead(upstream.status, getProxiedHeaders(upstream));
            upstream.data.pipe(res);
            res.on("close", () => upstream.data.destroy());
        } catch (error) {
            res.writeHead(502);
            res.end();
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
        return await fn(`http://127.0.0.1:${server.address().port}/`);
    } finally {
        upstreams.forEach((stream) => stream.destroy());
        server.closeAllConnections();
        server.close();
    }
};

// Drive no genera miniatura de algunos vídeos (no llegan a procesarse). Se saca un fotograma con ffmpeg,
// con pocos procesos a la vez: una carpeta de vídeos pide muchas miniaturas de golpe.
const MAX_CONCURRENT_VIDEO_FRAMES = 3;
let activeVideoFrames = 0;
const videoFrameQueue = [];
const extractDriveVideoFrame = async (client, fileId) => {
    if (activeVideoFrames >= MAX_CONCURRENT_VIDEO_FRAMES) await new Promise((resolve) => videoFrameQueue.push(resolve));
    activeVideoFrames += 1;
    try {
        return await withLocalDriveStream(client, fileId, extractRemoteVideoFrame);
    } finally {
        activeVideoFrames -= 1;
        videoFrameQueue.shift()?.();
    }
};

// Imagen de origen para las miniaturas: la que genera Drive o, si no hay, un fotograma del vídeo.
const getDriveThumbnailSource = async (client, driveFile, size) => {
    if (driveFile.thumbnailLink) {
        const response = await client.request({ url: resizeThumbnailLink(driveFile.thumbnailLink, size), responseType: "arraybuffer" });
        return Buffer.from(response.data);
    }
    return String(driveFile.mimeType).startsWith("video/") ? extractDriveVideoFrame(client, driveFile.id) : null;
};

// Imágenes fijas con miniatura de Drive: pueden llevar preview local. Los GIF no, porque perderían la animación.
const hasDrivePreviewSource = (driveFile) =>
    Boolean(driveFile.thumbnailLink) && String(driveFile.mimeType).startsWith("image/") && driveFile.mimeType !== "image/gif";

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

    // Original de una media de Drive, en streaming y con Range, para /api/v1/files/drive/<userId>-<fileId>.
    // La URL firmada solo se emite a quien puede ver la media; aquí se comprueba además que la media sigue
    // existiendo, así una URL de una media borrada deja de funcionar. Se usa la conexión del dueño.
    static async streamOriginal(driveKey, req, res, maxAge) {
        const match = /^(\d+)-([A-Za-z0-9_-]{10,200})$/.exec(driveKey);
        const sendError = (status, message) => res.status(status).json({ success: false, message });
        if (!match) return sendError(404, "File not found");
        const [, rawUserId, fileId] = match;
        const userId = Number(rawUserId);

        const media = await MediaModel.findDriveMediaBySource(userId, fileId);
        if (!media) return sendError(404, "File not found");

        const { client, ...clientError } = await this.getAuthorizedClient(userId);
        if (!client) return sendError(clientError.status === 503 ? 503 : 409, "Google Drive is not connected");

        let upstream;
        try {
            upstream = await requestDriveContent(client, fileId, req.headers.range);
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, userId);
            if (revoked) return sendError(409, revoked.error);
            throw error;
        }

        if (upstream.status >= 400) {
            upstream.data.destroy();
            if (upstream.status === 404) {
                await MediaModel.updateStorageStatus(media.id, "missing");
                return sendError(404, "This file is no longer in Google Drive");
            }
            if (upstream.status === 416) return res.status(416).end();
            return sendError(upstream.status === 403 ? 403 : 502, "Could not read this file from Google Drive");
        }

        res.status(upstream.status);
        res.set({ ...getProxiedHeaders(upstream), "Cache-Control": `private, max-age=${maxAge}` });
        if (!res.get("Content-Type") && media.source_mime_type) res.set("Content-Type", media.source_mime_type);
        res.removeHeader("Pragma");
        res.removeHeader("Expires");
        upstream.data.pipe(res);
        res.on("close", () => upstream.data.destroy());
        return undefined;
    }

    // Guarda como JPEG local la miniatura de Drive (o un fotograma, en vídeos sin ella); el original no se descarga.
    // En imágenes guarda además un preview grande: así el detalle y la edición no esperan al original de Drive.
    static async cacheDriveDerivatives(client, driveFile, userId) {
        const derivedFilename = getDriveDerivedFilename(userId, driveFile.id);
        const derivatives = { thumbpath: null, previewpath: null };
        const wantsPreview = hasDrivePreviewSource(driveFile);

        try {
            // Una sola descarga: el preview y la miniatura salen de la misma imagen.
            const source = await getDriveThumbnailSource(client, driveFile, wantsPreview ? PREVIEW_OPTIONS.width : THUMBNAIL_OPTIONS.width);
            if (!source) return derivatives;
            await writeJpeg(source, path.join(THUMBNAILS_UPLOAD_DIR, derivedFilename), THUMBNAIL_OPTIONS, 72);
            derivatives.thumbpath = `/uploads/thumbnails/${derivedFilename}`;

            // Los navegadores no muestran HEIC, así que siempre lleva preview. En el resto, un JPEG perdería
            // la transparencia: esas imágenes siguen mostrando el original.
            if (wantsPreview && (HEIC_MIME_TYPES.has(driveFile.mimeType) || !(await sharp(source).metadata()).hasAlpha)) {
                await writeJpeg(source, path.join(PREVIEWS_UPLOAD_DIR, derivedFilename), PREVIEW_OPTIONS, 85);
                derivatives.previewpath = `/uploads/previews/${derivedFilename}`;
            }
        } catch (error) {
            // Sin miniatura (Drive no la tiene y el vídeo no se pudo leer) la media se vincula igualmente.
            console.warn(`Could not cache Drive thumbnail for ${driveFile.id}:`, error.message);
        }

        return derivatives;
    }

    // Genera el preview local de una media de Drive vinculada antes de que existiera (script previews:drive).
    // Devuelve la ruta del preview o null si la media no admite preview (vídeo, GIF, transparencia).
    static async createMissingPreview(media) {
        const { client, ...clientError } = await this.getAuthorizedClient(media.user_id);
        if (!client) throw new Error(clientError.error);

        const driveApi = createDriveApi({ version: "v3", auth: client });
        const { data: driveFile } = await driveApi.files.get({ fileId: media.source_file_id, fields: "id, mimeType, thumbnailLink", supportsAllDrives: true });
        if (!hasDrivePreviewSource(driveFile)) return null;

        const { thumbpath, previewpath } = await this.cacheDriveDerivatives(client, driveFile, media.user_id);
        if (!previewpath) return null;

        await MediaModel.updateDerivativePaths(media.id, { thumbpath: thumbpath || media.thumbpath, previewpath });
        // Las portadas de álbum que usaban el original de Drive pasan al preview local.
        await AlbumModel.replaceCoverPaths(media.user_id, [media.filepath], previewpath, thumbpath || media.thumbpath);
        return previewpath;
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
                        // Drive ya la devuelve orientada y con el tamaño pedido: se envía sin recodificar.
                        const response = await client.request({ url: resizeThumbnailLink(driveFile.thumbnailLink, PREVIEW_SIZE), responseType: "arraybuffer" });
                        const contentType = String(getProxiedHeaders(response)["content-type"] || "").split(";")[0];
                        const type = contentType.startsWith("image/") ? contentType : "image/jpeg";
                        thumbnail = `data:${type};base64,${Buffer.from(response.data).toString("base64")}`;
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

        const mediaType = BROWSE_MEDIA_TYPES.has(query?.type) ? query.type : "all";
        const listQuery = buildBrowseQuery({ view, folderId, search, mediaType });
        const onlyMyDrive = !folderId && MY_DRIVE_ONLY_VIEWS.has(view);
        const files = [];
        let nextPageToken = pageToken;
        try {
            let pageReads = 0;
            do {
                const { data } = await driveApi.files.list({ ...listQuery, fields: BROWSE_FIELDS, pageSize: BROWSE_PAGE_SIZE, pageToken: nextPageToken, spaces: "drive" });
                const pageFiles = data.files || [];
                files.push(...(onlyMyDrive ? await this.filterMyDriveFiles(driveApi, user.id, pageFiles) : pageFiles));
                nextPageToken = data.nextPageToken || null;
                pageReads += 1;
            } while (onlyMyDrive && nextPageToken && files.length === 0 && pageReads < MAX_FILTERED_PAGE_READS);
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            if (getGoogleErrorStatus(error) === 404) return { error: "This Drive folder is not available", status: 404 };
            if (getGoogleErrorStatus(error) === 400 && pageToken) return { error: "This page of results expired. Reload the folder.", status: 400 };
            throw error;
        }

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
                // Los vídeos sin miniatura de Drive también la tienen: el servidor saca un fotograma.
                thumbnailUrl: !isFolder && (file.thumbnailLink || file.mimeType.startsWith("video/")) ? signDriveThumbnail(user.id, file.id, version) : null,
                inLibrary: linkedFileIds.has(file.id),
            };
        });

        return { data: { items, nextPageToken } };
    }

    // Deja solo los archivos cuya carpeta cuelga de "Mi unidad".
    static async filterMyDriveFiles(driveApi, userId, files) {
        let cache = myDriveFolderCache.get(userId);
        if (!cache || cache.expiresAt < Date.now()) {
            cache = { expiresAt: Date.now() + FOLDER_CACHE_TTL_MS, rootId: driveApi.files.get({ fileId: "root", fields: "id" }).then(({ data }) => data.id), folders: new Map() };
            myDriveFolderCache.set(userId, cache);
            // Si falla, no se guarda el error: el siguiente intento vuelve a preguntar a Drive.
            cache.rootId.catch(() => myDriveFolderCache.delete(userId));
        }
        const rootId = await cache.rootId;

        const isInMyDrive = (folderId, depth = 0) => {
            if (folderId === rootId) return Promise.resolve(true);
            if (depth > 30) return Promise.resolve(false);
            if (!cache.folders.has(folderId)) {
                cache.folders.set(
                    folderId,
                    driveApi.files
                        .get({ fileId: folderId, fields: "parents" })
                        .then(({ data }) => (data.parents?.[0] ? isInMyDrive(data.parents[0], depth + 1) : false))
                        .catch(() => false),
                );
            }
            return cache.folders.get(folderId);
        };

        const checks = await Promise.all(files.map((file) => (file.parents?.[0] ? isInMyDrive(file.parents[0]) : false)));
        return files.filter((_, index) => checks[index]);
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
            const { data: driveFile } = await driveApi.files.get({ fileId, fields: "id, mimeType, thumbnailLink", supportsAllDrives: true });
            const thumbnailSource = await getDriveThumbnailSource(client, driveFile, BROWSE_THUMBNAIL_SIZE);
            if (!thumbnailSource) return { error: "Thumbnail not available", status: 404 };

            // Se escribe en un temporal y se renombra, para no servir nunca un archivo a medias.
            const temporaryPath = `${filePath}.${process.pid}.tmp`;
            await writeJpeg(thumbnailSource, temporaryPath, { width: BROWSE_THUMBNAIL_SIZE, height: BROWSE_THUMBNAIL_SIZE, fit: "inside", withoutEnlargement: true }, 72);
            await fs.rename(temporaryPath, filePath);
            return { data: { filePath } };
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, userId);
            if (revoked) return revoked;
            // Archivo inaccesible o vídeo que ffmpeg no puede leer: el explorador muestra el icono del tipo.
            console.warn(`Could not create Drive browse thumbnail for ${fileId}:`, String(error.message).split("\n")[0]);
            return { error: "Thumbnail not available", status: 404 };
        }
    }

    static async ensureDriveTags() {
        await MediaModel.ensureDriveTags(DRIVE_TAG_NAME);
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

    // Resumen previo de "Add all": todas las fotos y vídeos de "Mi unidad" (sin compartidos ni copias de
    // ordenadores), cuántos ya están en Tagged y cuántos faltan, con su tamaño. No vincula nada.
    static async getLinkAllPreview(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const { client, connection, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;
        if (!hasReadonlyScope(connection)) return { error: "Reconnect Google Drive to add all your media.", status: 409 };
        const driveApi = createDriveApi({ version: "v3", auth: client });

        const files = [];
        let truncated = false;
        try {
            let pageToken;
            do {
                const { data } = await driveApi.files.list({
                    q: `trashed = false and ${MEDIA_QUERY}`,
                    fields: "nextPageToken, files(id, size, md5Checksum, parents)",
                    pageSize: 1000,
                    pageToken,
                    spaces: "drive",
                });
                files.push(...(await this.filterMyDriveFiles(driveApi, user.id, data.files || [])));
                pageToken = data.nextPageToken;
                if (files.length >= MAX_LINK_ALL_SCAN) {
                    truncated = Boolean(pageToken) || files.length > MAX_LINK_ALL_SCAN;
                    files.length = Math.min(files.length, MAX_LINK_ALL_SCAN);
                    break;
                }
            } while (pageToken);
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            throw error;
        }

        const linkedFileIds = await MediaModel.findLinkedDriveFileIds(user.id, files.map((file) => file.id));
        const notLinked = files.filter((file) => !linkedFileIds.has(file.id));
        const checksums = [...new Set(notLinked.map((file) => file.md5Checksum).filter(Boolean))];
        const localChecksums = new Set((await MediaModel.findLocalByChecksums(user.id, checksums)).map((media) => media.checksum_md5));
        const pending = notLinked.filter((file) => !localChecksums.has(file.md5Checksum));
        const sumBytes = (list) => list.reduce((total, file) => total + (Number(file.size) || 0), 0);

        return {
            data: {
                total: files.length,
                totalBytes: sumBytes(files),
                alreadyLinked: files.length - notLinked.length,
                localDuplicates: notLinked.length - pending.length,
                pendingCount: pending.length,
                pendingBytes: sumBytes(pending),
                fileIds: pending.map((file) => file.id),
                truncated,
                limit: MAX_LINK_ALL_SCAN,
            },
        };
    }

    // Convierte una media de Drive en media propia de Tagged, como si se hubiera subido desde el equipo:
    // descarga el original, genera sus derivados, quita la referencia a Drive y la tag "Google Drive".
    // Conserva id, nombre, autor, resto de tags, álbumes y favorito. En Drive no se toca nada.
    static async importSingleMedia(mediaId, { client, user }) {
        const media = await MediaModel.findByIdForUser(mediaId, user.id);
        if (!media || media.storage_provider !== "google_drive") return { type: "skipped", item: { id: mediaId, reason: "not_drive_media" } };

        const [localDuplicate] = media.checksum_md5 ? await MediaModel.findLocalByChecksums(user.id, [media.checksum_md5]) : [];
        if (localDuplicate) return { type: "skipped", item: { id: mediaId, reason: "already_in_tagged", duplicateId: localDuplicate.id } };

        const driveName = media.filename;
        const extension = (path.extname(driveName || "").toLowerCase() || ".bin").replace(/[^a-z0-9.]/g, "");
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
        const filePath = path.join(MEDIA_UPLOAD_DIR, filename);

        const upstream = await requestDriveContent(client, media.source_file_id);
        if (upstream.status !== 200) {
            upstream.data.destroy();
            if (upstream.status === 404) await MediaModel.updateStorageStatus(media.id, "missing");
            return { type: "skipped", item: { id: mediaId, reason: upstream.status === 404 ? "missing_in_drive" : "not_accessible" } };
        }

        try {
            await pipeline(upstream.data, createWriteStream(filePath));
            const { size } = await fs.stat(filePath);
            // Mismo objeto que deja multer, para generar los derivados igual que en una subida.
            const file = { filename, path: filePath, originalname: driveName, mimetype: media.source_mime_type || "" };
            const derivatives = await generateMediaDerivatives(file, media.mediatype === "gif" ? "image" : media.mediatype);

            const converted = await MediaModel.convertDriveToLocal(media.id, {
                filename,
                size,
                filepath: `/uploads/media/${filename}`,
                thumbpath: derivatives.thumbnailPath,
                previewpath: derivatives.previewPath,
                checksum_md5: await computeFileMd5(filePath),
            });
            if (!converted) throw new Error("Media changed while importing");
        } catch (error) {
            await fs.rm(filePath, { force: true });
            await removeMediaDerivatives(filename);
            throw error;
        }

        await MediaTagModel.deleteSpecificTagsByNameForMedia(media.id, [DRIVE_TAG_NAME], user.id);
        const updated = await MediaModel.findById(media.id);
        // Las portadas de álbum guardan la ruta de la media: se apuntan a los archivos nuevos.
        await AlbumModel.replaceCoverPaths(user.id, [media.previewpath, media.filepath].filter(Boolean), updated.previewpath || updated.filepath, updated.thumbpath);
        await removeStoredMediaFiles(media);

        return { type: "imported", item: { id: media.id, name: driveName } };
    }

    static async importMedia(body, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const mediaIds = [...new Set(Array.isArray(body?.mediaIds) ? body.mediaIds.map(Number) : [])];
        if (mediaIds.length === 0 || mediaIds.length > MAX_IMPORT_MEDIA || !mediaIds.every((id) => Number.isInteger(id) && id > 0)) {
            return { error: `Select between 1 and ${MAX_IMPORT_MEDIA} media`, status: 400 };
        }

        const { client, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;

        const result = { imported: [], skipped: [] };
        try {
            // De una en una: cada importación descarga un original que puede pesar varios GB.
            for (const mediaId of mediaIds) {
                try {
                    const { type, item } = await this.importSingleMedia(mediaId, { client, user });
                    result[type].push(item);
                } catch (error) {
                    if (isRevokedGrantError(error)) throw error;
                    console.error(`Could not import Drive media ${mediaId}:`, error.message);
                    result.skipped.push({ id: mediaId, reason: "failed" });
                }
            }
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            throw error;
        }

        if (result.imported.length > 0) {
            await AuditService.logEvent({
                actionCode: "GOOGLE_DRIVE_IMPORT",
                req,
                statusCode: 200,
                message: `Imported ${result.imported.length} Google Drive media into Tagged`,
                metadata: { mediaIds: result.imported.map((item) => item.id) },
            });
        }
        return { data: result };
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
        // Toda media de Drive lleva la tag "Google Drive", además de las elegidas.
        const context = { client, driveApi, user, body, isFavourite: validation.isFavourite, tagNames: withDriveTag(parsedTagNames.data), now: new Date() };

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
        // La tag de sistema existe desde que se conecta la cuenta, lista para filtrar por ella.
        await MediaService.getOrCreateTagIdsForUser([DRIVE_TAG_NAME], user.id);
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
