// Columnas de media que se devuelven al cliente. Centralizadas para que todas las consultas
// (galería, detalle, álbumes...) expongan los mismos campos.
const MEDIA_FIELDS = [
    "id",
    "user_id",
    "displayname",
    "author",
    "filename",
    "size",
    "filepath",
    "thumbpath",
    "previewpath",
    "mediatype",
    "is_favourite",
    "updatedAt",
    "storage_provider",
    "storage_status",
    "source_file_id",
];

const selectMediaColumns = (alias = "") => MEDIA_FIELDS.map((field) => (alias ? `${alias}.${field}` : field)).join(", ");

module.exports = { MEDIA_FIELDS, selectMediaColumns };
