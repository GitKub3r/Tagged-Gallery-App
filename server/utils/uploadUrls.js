const crypto = require("crypto");
const path = require("path");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const UPLOADS_PREFIX = "/uploads/";
const FILES_ROUTE = "/api/v1/files/";

// Claves de respuesta que contienen rutas internas de /uploads. Solo se firman estas,
// nunca textos introducidos por el usuario (nombres, tags...), para no emitir enlaces ajenos.
const SIGNED_KEYS = new Set(["filepath", "thumbpath", "previewpath", "albumcoverpath", "albumthumbpath", "avatar_path"]);

// Las URLs caducan al final de una franja fija para que sean estables y el navegador pueda cachearlas.
const WINDOW_SECONDS = 12 * 60 * 60;
const MIN_REMAINING_SECONDS = 6 * 60 * 60;

const RELATIVE_PATH_PATTERN = /^(media|thumbnails|previews|avatars)\/[A-Za-z0-9._-]+$/;

const getSigningSecret = () => {
    const secret = process.env.MEDIA_URL_SIGNING_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("MEDIA_URL_SIGNING_SECRET (or JWT_SECRET) must be defined to serve uploaded files");
    }
    return secret;
};

const createSignature = (relativePath, expiresAt) =>
    crypto.createHmac("sha256", getSigningSecret()).update(`${relativePath}:${expiresAt}`).digest("base64url");

const getExpiry = (nowSeconds = Math.floor(Date.now() / 1000)) =>
    Math.ceil((nowSeconds + MIN_REMAINING_SECONDS) / WINDOW_SECONDS) * WINDOW_SECONDS;

const signUploadPath = (uploadPath) => {
    const relativePath = uploadPath.slice(UPLOADS_PREFIX.length);
    if (!RELATIVE_PATH_PATTERN.test(relativePath)) return null;

    const expiresAt = getExpiry();
    const signature = createSignature(relativePath, expiresAt);
    return `${FILES_ROUTE}${relativePath}?exp=${expiresAt}&sig=${signature}`;
};

const verifyUploadRequest = (relativePath, expiresAt, signature) => {
    if (!RELATIVE_PATH_PATTERN.test(String(relativePath || ""))) return { valid: false };

    const expiry = Number(expiresAt);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(expiry) || expiry <= nowSeconds) return { valid: false };

    const expected = Buffer.from(createSignature(relativePath, expiry));
    const received = Buffer.from(String(signature || ""));
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return { valid: false };

    return { valid: true, filePath: path.join(UPLOADS_ROOT, relativePath), maxAge: expiry - nowSeconds };
};

const signUploadReferences = (value) => {
    if (Array.isArray(value)) return value.map(signUploadReferences);
    if (!value || typeof value !== "object" || Buffer.isBuffer(value) || typeof value.toJSON === "function") return value;

    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => {
            if (SIGNED_KEYS.has(key) && typeof entry === "string" && entry.startsWith(UPLOADS_PREFIX)) {
                return [key, signUploadPath(entry)];
            }
            return [key, signUploadReferences(entry)];
        }),
    );
};

// Sustituye las rutas internas de /uploads de cualquier respuesta JSON de la API por URLs firmadas.
const signUploadUrlsInResponses = (req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (body) => sendJson(signUploadReferences(body));
    next();
};

module.exports = {
    signUploadPath,
    verifyUploadRequest,
    signUploadUrlsInResponses,
};
