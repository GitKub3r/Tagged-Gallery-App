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
const { THUMBNAILS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR } = require("../middlewares/upload.middleware");

// GOOGLE_DRIVE_ACCESS elige el permiso sobre Drive:
// - "file" (por defecto): solo los archivos elegidos en el Picker. No requiere verificación de Google.
// - "readonly": lectura de todo el Drive. Permiso restringido: sin verificación solo sirve en modo Prueba
//   (usuarios de prueba). Permite, por ejemplo, que el Picker muestre miniaturas.
const DRIVE_SCOPES = {
    file: "https://www.googleapis.com/auth/drive.file",
    readonly: "https://www.googleapis.com/auth/drive.readonly",
};
const getDriveAccess = () => (process.env.GOOGLE_DRIVE_ACCESS === "readonly" ? "readonly" : "file");
const getDriveScope = () => DRIVE_SCOPES[getDriveAccess()];
const getOAuthScopes = () => [getDriveScope(), "openid", "email"];

const isConfigured = () =>
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_API_KEY && process.env.GOOGLE_APP_ID) &&
    hasEncryptionKey();

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
const PREVIEW_CONCURRENCY = 6;

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
    // Datos públicos que el cliente necesita para Google Identity Services y el Picker.
    config: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        apiKey: process.env.GOOGLE_API_KEY,
        appId: process.env.GOOGLE_APP_ID,
        scopes: getOAuthScopes(),
    },
    // Permiso que la app pide ahora y permiso que concedió el usuario al conectar.
    requiredAccess: getDriveAccess(),
    grantedAccess: String(connection?.scopes || "").split(" ").includes(DRIVE_SCOPES.readonly) ? "readonly" : "file",
    connected: Boolean(connection && connection.status === "connected"),
    // La conexión se hizo con otro permiso (p. ej. se cambió GOOGLE_DRIVE_ACCESS): hay que volver a conectar.
    needsReconnect: Boolean(connection && connection.status === "connected" && !String(connection.scopes).split(" ").includes(getDriveScope())),
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

        const client = createOAuthClient();
        client.setCredentials({ refresh_token: decrypt(connection.refresh_token_encrypted) });
        return { client };
    }

    // Si Google invalida el acceso (el usuario lo revocó desde su cuenta), la conexión y sus medias pasan a "revoked".
    static async handleRevokedGrant(error, userId) {
        if (!isRevokedGrantError(error)) return null;
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

    static async getPickerToken(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const { client, ...clientError } = await this.getAuthorizedClient(user.id);
        if (!client) return clientError;

        try {
            const { token } = await client.getAccessToken();
            return { data: { accessToken: token, expiresAt: client.credentials.expiry_date || null } };
        } catch (error) {
            const revoked = await this.handleRevokedGrant(error, user.id);
            if (revoked) return revoked;
            throw error;
        }
    }

    // Vistas previas de los archivos elegidos en el Picker para el modal de revisión (tras la selección Tagged
    // ya tiene acceso a ellos, también con drive.file). Se devuelven como data URL y no se guardan.
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
        const now = new Date();

        for (const fileId of fileIds) {
            if (linkedFileIds.has(fileId)) {
                result.alreadyLinked.push({ fileId });
                continue;
            }

            let driveFile;
            try {
                ({ data: driveFile } = await driveApi.files.get({ fileId, fields: DRIVE_FILE_FIELDS, supportsAllDrives: true }));
            } catch (error) {
                const revoked = await this.handleRevokedGrant(error, user.id);
                if (revoked) return revoked;
                const status = getGoogleErrorStatus(error);
                if (status === 403 || status === 404) {
                    result.skipped.push({ fileId, reason: "not_accessible" });
                    continue;
                }
                throw error;
            }

            if (driveFile.trashed || !isSupportedDriveMimeType(driveFile.mimeType)) {
                result.skipped.push({ fileId, name: driveFile.name, reason: driveFile.trashed ? "trashed" : "unsupported_type" });
                continue;
            }

            // Si ya existe la misma media como archivo local, se ofrece convertirla en lugar de duplicarla.
            const [localDuplicate] = driveFile.md5Checksum
                ? await MediaModel.findLocalByChecksums(user.id, [driveFile.md5Checksum])
                : [];
            if (localDuplicate) {
                result.duplicates.push({
                    driveFile: { id: driveFile.id, name: driveFile.name, mimeType: driveFile.mimeType, size: Number(driveFile.size) || 0 },
                    media: { id: localDuplicate.id, displayname: localDuplicate.displayname, thumbpath: localDuplicate.thumbpath },
                });
                continue;
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
                    is_favourite: validation.isFavourite,
                    checksum_md5: driveFile.md5Checksum || null,
                    storage_provider: "google_drive",
                    source_file_id: driveFile.id,
                    source_mime_type: driveFile.mimeType,
                    source_modified_time: driveFile.modifiedTime ? new Date(driveFile.modifiedTime) : null,
                    last_synced_at: now,
                });
            } catch (error) {
                // Otra petición simultánea lo vinculó antes (índice único usuario + archivo de Drive).
                if (error.code === "ER_DUP_ENTRY") {
                    result.alreadyLinked.push({ fileId });
                    continue;
                }
                throw error;
            }
            await MediaService.attachTagsToMedia(created.id, parsedTagNames.data, user.id);
            result.linked.push({ id: created.id, name: driveFile.name });
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
        if (!grantedScopes.includes(getDriveScope())) {
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
            if (scopes.includes(getDriveScope())) return storedRefreshToken;
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

        await GoogleDriveConnectionModel.deleteByUserId(user.id);
        await GoogleDriveConnectionModel.markUserMediaStatus(user.id, "revoked");
        await AuditService.logEvent({ actionCode: "GOOGLE_DRIVE_DISCONNECT", req, statusCode: 200, message: "Google Drive disconnected" });

        return { data: isConfigured() ? toStatus(null) : { configured: false, connected: false, status: "disconnected" } };
    }
}

module.exports = GoogleDriveService;
