const fs = require("fs");
const path = require("path");
const multer = require("multer");

const MAX_UPLOAD_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const MEDIA_UPLOAD_DIR = path.join(UPLOADS_ROOT, "media");
const THUMBNAILS_UPLOAD_DIR = path.join(UPLOADS_ROOT, "thumbnails");
const AVATARS_UPLOAD_DIR = path.join(UPLOADS_ROOT, "avatars");

const ensureUploadDirs = () => {
    fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });
    fs.mkdirSync(THUMBNAILS_UPLOAD_DIR, { recursive: true });
    fs.mkdirSync(AVATARS_UPLOAD_DIR, { recursive: true });
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
        req.pendingUploadPaths ||= [];
        req.pendingUploadPaths.push(path.join(MEDIA_UPLOAD_DIR, uniqueName));
        cb(null, uniqueName);
    },
});

const trackUploadCancellation = (req, res, next) => {
    req.uploadCancelled = false;

    const cancelAndClean = () => {
        req.uploadCancelled = true;
        (req.pendingUploadPaths || []).forEach((filePath) => fs.rm(filePath, { force: true }, () => {}));
    };

    req.once("aborted", cancelAndClean);
    res.once("close", () => {
        if (!res.writableEnded) cancelAndClean();
    });
    next();
};

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

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadDirs();
        cb(null, AVATARS_UPLOAD_DIR);
    },
    filename: (req, file, cb) => cb(null, `user-${req.user.id}-${Date.now()}.jpg`),
});

const avatarUpload = multer({
    storage: avatarStorage,
    fileFilter: (req, file, cb) => cb(file.mimetype === "image/jpeg" || file.mimetype === "image/png" ? null : new Error("Only JPEG and PNG images are allowed"), file.mimetype === "image/jpeg" || file.mimetype === "image/png"),
    limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = {
    upload,
    ensureUploadDirs,
    UPLOADS_ROOT,
    MEDIA_UPLOAD_DIR,
    THUMBNAILS_UPLOAD_DIR,
    AVATARS_UPLOAD_DIR,
    avatarUpload,
    trackUploadCancellation,
};
