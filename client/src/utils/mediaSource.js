// El original de la media vive en Google Drive (Tagged solo guarda la referencia y la miniatura).
export const isDriveMedia = (media) => media?.storage_provider === "google_drive";

// Tag de sistema que el backend pone a toda media de Drive. En los formularios se muestra bloqueada.
export const DRIVE_TAG_NAME = "Google Drive";
export const isDriveTagName = (tagName) => String(tagName || "").trim().toLowerCase() === DRIVE_TAG_NAME.toLowerCase();

// Días que una media pasa en la papelera (Trash.service en el servidor).
export const TRASH_RETENTION_DAYS = 30;

// Texto del modal de borrado. Borrar envía a la papelera; una media de Drive solo se quita de Tagged
// y su original sigue en Drive.
export const describeMediaDeletion = (mediaCount, driveMediaCount = 0) => {
    const subject = mediaCount === 1 ? "It goes" : `${mediaCount} media go`;
    const trashNote = `${subject} to the trash with ${mediaCount === 1 ? "its" : "their"} tags and albums. You can restore ${mediaCount === 1 ? "it" : "them"} for ${TRASH_RETENTION_DAYS} days; after that ${mediaCount === 1 ? "it is" : "they are"} deleted forever.`;
    if (driveMediaCount === 0) return trashNote;
    if (driveMediaCount === mediaCount) {
        return `${trashNote} Originals from Google Drive always stay in your Drive.`;
    }
    return `${trashNote} The ${driveMediaCount} from Google Drive keep their originals in your Drive.`;
};

// Texto de la confirmación de importar: la media pasa a ser de Tagged, como si se hubiera subido.
export const DRIVE_IMPORT_DESCRIPTION =
    "The original is copied from Google Drive into Tagged and the link with Drive is removed, as if you had uploaded it. It keeps its name, author, tags, albums and favourite; only the Google Drive tag is removed. Nothing changes in your Drive.";
