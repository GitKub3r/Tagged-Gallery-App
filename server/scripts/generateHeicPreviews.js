// Genera el preview JPEG de las medias HEIC/HEIF subidas antes de existir previewpath.
// También mueve a ese preview las portadas de álbum que apuntaban al original HEIC.
// Es idempotente: solo procesa medias con previewpath vacío.
// Uso: npm run previews:heic --prefix server
require("dotenv").config();

const path = require("path");
const { pool } = require("../config/database");
const MediaModel = require("../models/Media.model");
const { MEDIA_UPLOAD_DIR, THUMBNAILS_UPLOAD_DIR, PREVIEWS_UPLOAD_DIR, ensureUploadDirs } = require("../middlewares/upload.middleware");
const { isHeicFile, createHeicDerivatives, getDerivedFilename } = require("../utils/media");

const run = async () => {
    ensureUploadDirs();
    await MediaModel.ensureColumns();

    const [rows] = await pool.query(
        "SELECT id, filename, filepath FROM media WHERE storage_provider = 'local' AND previewpath IS NULL AND (LOWER(filename) LIKE '%.heic' OR LOWER(filename) LIKE '%.heif')",
    );

    let converted = 0;
    for (const media of rows) {
        if (!isHeicFile({ filename: media.filename })) continue;

        const derivedFilename = getDerivedFilename(media.filename);
        const previewPath = `/uploads/previews/${derivedFilename}`;

        try {
            await createHeicDerivatives(
                path.join(MEDIA_UPLOAD_DIR, media.filename),
                path.join(THUMBNAILS_UPLOAD_DIR, derivedFilename),
                path.join(PREVIEWS_UPLOAD_DIR, derivedFilename),
            );
            await pool.query("UPDATE media SET previewpath = ? WHERE id = ?", [previewPath, media.id]);
            await pool.query("UPDATE albums SET albumcoverpath = ? WHERE albumcoverpath = ?", [previewPath, media.filepath]);
            converted += 1;
            console.log(`✓ media ${media.id} (${media.filename})`);
        } catch (error) {
            console.error(`✗ media ${media.id} (${media.filename}): ${error.message}`);
        }
    }

    console.log(`\nGenerated ${converted} of ${rows.length} HEIC previews.`);
};

run()
    .catch((error) => {
        console.error("Could not generate HEIC previews:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
