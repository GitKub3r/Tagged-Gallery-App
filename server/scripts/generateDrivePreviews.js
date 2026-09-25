// Genera el preview local de las imágenes de Google Drive vinculadas antes de que existiera.
// Sin él, el detalle y la edición cargan el original desde Drive. Mueve también las portadas de álbum.
// Es idempotente: solo procesa medias de Drive con previewpath vacío.
// Uso: npm run previews:drive --prefix server
require("dotenv").config();

const { pool } = require("../config/database");
const MediaModel = require("../models/Media.model");
const GoogleDriveService = require("../services/GoogleDrive.service");
const { ensureUploadDirs } = require("../middlewares/upload.middleware");

const run = async () => {
    ensureUploadDirs();
    await MediaModel.ensureColumns();

    const rows = await MediaModel.findDriveImagesWithoutPreview();
    let generated = 0;
    for (const media of rows) {
        try {
            const previewPath = await GoogleDriveService.createMissingPreview(media);
            if (previewPath) generated += 1;
            console.log(`${previewPath ? "✓" : "–"} media ${media.id}${previewPath ? "" : " (no preview: transparency or no Drive thumbnail)"}`);
        } catch (error) {
            console.error(`✗ media ${media.id}: ${String(error.message).split("\n")[0]}`);
        }
    }

    console.log(`\nGenerated ${generated} of ${rows.length} Google Drive previews.`);
};

run()
    .catch((error) => {
        console.error("Could not generate Google Drive previews:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
