const fs = require("fs");
const path = require("path");
const multer = require("multer");

const MAX_UPLOAD_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const MEDIA_UPLOAD_DIR = path.join(UPLOADS_ROOT, "media");
const THUMBNAILS_UPLOAD_DIR = path.join(UPLOADS_ROOT, "thumbnails");

const ensureUploadDirs = () => {
    fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });
    fs.mkdirSync(THUMBNAILS_UPLOAD_DIR, { recursive: true });
};

const isSupportedMimeType = (mimeType = "") => {
    return mimeType.startsWith("image/") || mimeType.startsWith("video/");
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadDirs();
        cb(null, MEDIA_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname || "").toLowerCase();
        const safeExtension = extension || ".bin";
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;
        cb(null, uniqueName);
    },
});

const fileFilter = (req, file, cb) => {
    if (!isSupportedMimeType(file.mimetype)) {
        return cb(new Error("Only image, gif and video files are allowed"));
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    },
});

module.exports = {
    upload,
    ensureUploadDirs,
    UPLOADS_ROOT,
    MEDIA_UPLOAD_DIR,
    THUMBNAILS_UPLOAD_DIR,
};
