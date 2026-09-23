const crypto = require("crypto");
const { createReadStream } = require("fs");
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { MEDIA_UPLOAD_DIR, THUMBNAILS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR } = require("../middlewares/upload.middleware");

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

const detectMediaType = (mimeType = "", filename = "") => {
    const extension = path.extname(String(filename || "")).toLowerCase();

    if (mimeType === "image/gif") {
        return "gif";
    }

    if (mimeType.startsWith("image/") || extension === ".heic" || extension === ".heif") {
        return "image";
    }

    if (mimeType.startsWith("video/")) {
        return "video";
    }

    throw new Error("Unsupported media type");
};

const isHeicFile = (uploadedFile) => {
    const mimeType = String(uploadedFile?.mimetype || "").toLowerCase();
    const extension = path.extname(String(uploadedFile?.originalname || uploadedFile?.filename || "")).toLowerCase();

    return mimeType === "image/heic" || mimeType === "image/heif" || extension === ".heic" || extension === ".heif";
};

const THUMBNAIL_OPTIONS = { width: 640, height: 640, fit: "inside", withoutEnlargement: true };
// Versión de visualización para formatos que los navegadores no muestran (HEIC/HEIF).
const PREVIEW_OPTIONS = { width: 2560, height: 2560, fit: "inside", withoutEnlargement: true };

const decodeHeicToJpeg = async (inputFilePath) =>
    heicConvert({
        buffer: await fs.readFile(inputFilePath),
        format: "JPEG",
        quality: 0.92,
    });

const writeJpeg = (input, outputFilePath, resizeOptions, quality) =>
    sharp(input, { failOn: "none" }).rotate().resize(resizeOptions).jpeg({ quality, mozjpeg: true }).toFile(outputFilePath);

const createHeicDerivatives = async (inputFilePath, thumbnailFilePath, previewFilePath) => {
    const jpegBuffer = await decodeHeicToJpeg(inputFilePath);
    await writeJpeg(jpegBuffer, previewFilePath, PREVIEW_OPTIONS, 85);
    await writeJpeg(jpegBuffer, thumbnailFilePath, THUMBNAIL_OPTIONS, 72);
};

const createVideoThumbnail = async (inputFilePath, thumbnailFilePath) => {
    await new Promise((resolve, reject) => {
        ffmpeg(inputFilePath)
            .outputOptions(["-frames:v 1"])
            .on("end", resolve)
            .on("error", reject)
            .screenshots({
                count: 1,
                timemarks: ["0.2"],
                filename: path.basename(thumbnailFilePath),
                folder: path.dirname(thumbnailFilePath),
                size: "640x?",
            });
    });

    await sharp(thumbnailFilePath).resize(THUMBNAIL_OPTIONS).jpeg({ quality: 72, mozjpeg: true }).toFile(thumbnailFilePath + ".tmp");

    await fs.rename(thumbnailFilePath + ".tmp", thumbnailFilePath);
};

const REMOTE_FRAME_TIMEOUT_MS = 45 * 1000;

const readRemoteFrame = (url, seconds) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        const command = ffmpeg(url)
            .inputOptions(["-ss", String(seconds)])
            .outputOptions(["-frames:v 1", "-f image2pipe", "-vcodec mjpeg"])
            .on("error", (error) => {
                clearTimeout(timeoutId);
                reject(error);
            })
            .on("end", () => {
                clearTimeout(timeoutId);
                resolve(Buffer.concat(chunks));
            });
        const timeoutId = setTimeout(() => command.kill("SIGKILL"), REMOTE_FRAME_TIMEOUT_MS);
        command.pipe().on("data", (chunk) => chunks.push(chunk));
    });

// Fotograma JPEG de un vídeo servido por HTTP sin descargarlo entero: ffmpeg pide solo los rangos que necesita
// (también si el índice del MP4 está al final). Si el segundo 1 no existe (vídeo muy corto), se usa el inicio.
// El ffmpeg estático no resuelve nombres de dominio: la URL debe ser local (ver GoogleDrive.service).
const extractRemoteVideoFrame = async (url) => {
    const frame = await readRemoteFrame(url, 1);
    if (frame.length > 0) return frame;
    const firstFrame = await readRemoteFrame(url, 0);
    if (firstFrame.length === 0) throw new Error("Could not read a video frame");
    return firstFrame;
};

const getDerivedFilename = (mediaFilename) => `${path.parse(mediaFilename).name}.jpg`;

// Genera la miniatura y, para HEIC/HEIF, un preview JPEG que el navegador puede mostrar.
// El original se conserva intacto para las descargas.
const generateMediaDerivatives = async (uploadedFile, mediaType) => {
    const derivedFilename = getDerivedFilename(uploadedFile.filename);
    const thumbnailFilePath = path.join(THUMBNAILS_UPLOAD_DIR, derivedFilename);
    let previewPath = null;

    if (mediaType === "video") {
        await createVideoThumbnail(uploadedFile.path, thumbnailFilePath);
    } else if (isHeicFile(uploadedFile)) {
        await createHeicDerivatives(uploadedFile.path, thumbnailFilePath, path.join(PREVIEWS_UPLOAD_DIR, derivedFilename));
        previewPath = `/uploads/previews/${derivedFilename}`;
    } else {
        await writeJpeg(uploadedFile.path, thumbnailFilePath, THUMBNAIL_OPTIONS, 72);
    }

    return {
        thumbnailPath: `/uploads/thumbnails/${derivedFilename}`,
        previewPath,
    };
};

const removeMediaDerivatives = async (mediaFilename) => {
    const derivedFilename = getDerivedFilename(mediaFilename);
    await Promise.all([
        fs.rm(path.join(THUMBNAILS_UPLOAD_DIR, derivedFilename), { force: true }),
        fs.rm(path.join(PREVIEWS_UPLOAD_DIR, derivedFilename), { force: true }),
    ]);
};

// Derivados cacheados de una media de Google Drive (miniatura y preview). El original vive en Drive.
const getDriveDerivedFilename = (userId, fileId) => `drive-${userId}-${fileId}.jpg`;

// Borra los archivos que Tagged guarda en disco para una media. En las de Drive solo se borran los
// derivados cacheados: el original nunca se toca y su filename (nombre en Drive) no se usa como ruta.
const removeStoredMediaFiles = async (media) => {
    if (media.storage_provider === "google_drive") {
        const derivedFilename = getDriveDerivedFilename(media.user_id, media.source_file_id);
        await Promise.all([
            fs.rm(path.join(THUMBNAILS_UPLOAD_DIR, derivedFilename), { force: true }),
            fs.rm(path.join(PREVIEWS_UPLOAD_DIR, derivedFilename), { force: true }),
        ]);
        return;
    }

    await Promise.all([fs.rm(path.join(MEDIA_UPLOAD_DIR, media.filename), { force: true }), removeMediaDerivatives(media.filename)]);
};

// MD5 del archivo en streaming (sin cargarlo en memoria). Coincide con md5Checksum de Google Drive
// y permite detectar duplicados entre medias locales y archivos de Drive.
const computeFileMd5 = (filePath) =>
    new Promise((resolve, reject) => {
        const hash = crypto.createHash("md5");
        createReadStream(filePath)
            .on("error", reject)
            .on("data", (chunk) => hash.update(chunk))
            .on("end", () => resolve(hash.digest("hex")));
    });

module.exports = {
    detectMediaType,
    computeFileMd5,
    isHeicFile,
    createHeicDerivatives,
    generateMediaDerivatives,
    removeMediaDerivatives,
    removeStoredMediaFiles,
    getDriveDerivedFilename,
    writeJpeg,
    extractRemoteVideoFrame,
    THUMBNAIL_OPTIONS,
    PREVIEW_OPTIONS,
    getDerivedFilename,
};
