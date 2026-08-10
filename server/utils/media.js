const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const heicConvert = require("heic-convert");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const { THUMBNAILS_UPLOAD_DIR } = require("../middlewares/upload.middleware");

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

const createHeicThumbnail = async (inputFilePath, thumbnailFilePath) => {
    const inputBuffer = await fs.readFile(inputFilePath);
    const jpegBuffer = await heicConvert({
        buffer: inputBuffer,
        format: "JPEG",
        quality: 0.82,
    });

    await sharp(jpegBuffer, { failOn: "none" })
        .rotate()
        .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(thumbnailFilePath);
};

const createImageThumbnail = async (uploadedFile, thumbnailFilePath) => {
    if (isHeicFile(uploadedFile)) {
        await createHeicThumbnail(uploadedFile.path, thumbnailFilePath);
        return;
    }

    await sharp(uploadedFile.path, { failOn: "none" })
        .rotate()
        .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(thumbnailFilePath);
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

    await sharp(thumbnailFilePath)
        .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(thumbnailFilePath + ".tmp");

    await fs.rename(thumbnailFilePath + ".tmp", thumbnailFilePath);
};

const generateThumbnail = async (uploadedFile, mediaType) => {
    const basenameWithoutExt = path.parse(uploadedFile.filename).name;
    const thumbnailFilename = `${basenameWithoutExt}.jpg`;
    const thumbnailFilePath = path.join(THUMBNAILS_UPLOAD_DIR, thumbnailFilename);

    if (mediaType === "video") {
        await createVideoThumbnail(uploadedFile.path, thumbnailFilePath);
    } else {
        await createImageThumbnail(uploadedFile, thumbnailFilePath);
    }

    return {
        thumbnailFilename,
        thumbnailPath: `/uploads/thumbnails/${thumbnailFilename}`,
    };
};

module.exports = {
    detectMediaType,
    generateThumbnail,
};
