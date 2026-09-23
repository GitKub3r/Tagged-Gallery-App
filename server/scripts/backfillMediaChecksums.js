// Calcula el MD5 de las medias locales subidas antes de existir checksum_md5.
// Se usa para detectar duplicados al vincular archivos de Google Drive.
// Es idempotente: solo procesa medias locales con checksum_md5 vacío.
// Uso: npm run checksums:backfill --prefix server
require("dotenv").config();

const path = require("path");
const { pool } = require("../config/database");
const MediaModel = require("../models/Media.model");
const { MEDIA_UPLOAD_DIR } = require("../middlewares/upload.middleware");
const { computeFileMd5 } = require("../utils/media");

const run = async () => {
    await MediaModel.ensureColumns();

    const [rows] = await pool.query(
        "SELECT id, filename FROM media WHERE storage_provider = 'local' AND checksum_md5 IS NULL ORDER BY id ASC",
    );

    let updated = 0;
    for (const media of rows) {
        try {
            const checksum = await computeFileMd5(path.join(MEDIA_UPLOAD_DIR, media.filename));
            await pool.query("UPDATE media SET checksum_md5 = ? WHERE id = ?", [checksum, media.id]);
            updated += 1;
            console.log(`✓ media ${media.id} (${media.filename}) ${checksum}`);
        } catch (error) {
            console.error(`✗ media ${media.id} (${media.filename}): ${error.message}`);
        }
    }

    console.log(`\nUpdated ${updated} of ${rows.length} media checksums.`);
};

run()
    .catch((error) => {
        console.error("Could not backfill media checksums:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
