// Recupera la fecha de subida (created_at) de las medias a partir del nombre físico del archivo,
// que empieza por el Date.now() de la subida. La columna created_at se añadió después del esquema
// inicial y las filas existentes recibieron la fecha en que se creó.
// Es idempotente y no toca updatedAt.
// Uso: npm run dates:backfill --prefix server
require("dotenv").config();

const { pool } = require("../config/database");
const MediaModel = require("../models/Media.model");

const run = async () => {
    await MediaModel.ensureColumns();
    const updated = await MediaModel.backfillCreatedAtFromFilenames();
    console.log(`Updated the upload date of ${updated} media.`);
};

run()
    .catch((error) => {
        console.error("Could not backfill media upload dates:", error);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
