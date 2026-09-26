// Guarda la resolución (width y height) de las medias subidas o vinculadas antes de que existieran esas columnas.
// La usan las reglas con la condición "Resolution" y "Orientation". Las locales se leen del archivo en disco;
// las de Google Drive se piden a Drive (solo metadatos, el original no se descarga).
// Es idempotente: solo procesa medias sin resolución.
// Uso: npm run dimensions:backfill --prefix server
require("dotenv").config();

const path = require("path");
const { pool } = require("../config/database");
const MediaModel = require("../models/Media.model");
const GoogleDriveService = require("../services/GoogleDrive.service");
const { MEDIA_UPLOAD_DIR } = require("../middlewares/upload.middleware");
const { isHeicFile, decodeHeicToJpeg, readMediaDimensions } = require("../utils/media");

const readLocalDimensions = async (media) => {
    const filePath = path.join(MEDIA_UPLOAD_DIR, media.filename);
    // sharp no decodifica HEIC: se lee la resolución del JPEG convertido.
    const input = media.mediatype !== "video" && isHeicFile({ filename: media.filename }) ? await decodeHeicToJpeg(filePath) : filePath;
    return readMediaDimensions(input, media.mediatype);
};

const run = async () => {
    await MediaModel.ensureColumns();

    const rows = await MediaModel.findWithoutDimensions();
    let updated = 0;
    for (const media of rows) {
        try {
            const dimensions = media.storage_provider === "google_drive" ? await GoogleDriveService.readDriveDimensions(media) : await readLocalDimensions(media);
            if (dimensions) {
                await MediaModel.updateDimensions(media.id, dimensions);
                updated += 1;
            }
            console.log(`${dimensions ? "✓" : "–"} media ${media.id} ${dimensions ? `${dimensions.width}x${dimensions.height}` : "(resolution unavailable)"}`);
        } catch (error) {
            console.error(`✗ media ${media.id}: ${String(error.message).split("\n")[0]}`);
        }
    }

    console.log(`\nSaved the resolution of ${updated} of ${rows.length} media.`);
};

run()
    .catch((error) => {
        console.error("Could not backfill media dimensions:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
