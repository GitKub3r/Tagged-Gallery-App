// El original de la media vive en Google Drive (Tagged solo guarda la referencia y la miniatura).
export const isDriveMedia = (media) => media?.storage_provider === "google_drive";

// Tag de sistema que el backend pone a toda media de Drive. En los formularios se muestra bloqueada.
export const DRIVE_TAG_NAME = "Google Drive";
export const isDriveTagName = (tagName) => String(tagName || "").trim().toLowerCase() === DRIVE_TAG_NAME.toLowerCase();

const pluralFiles = (count) => `${count} file${count === 1 ? "" : "s"}`;

// Texto del modal de borrado. Borrar una media de Drive solo la quita de Tagged: el original sigue en Drive.
export const describeMediaDeletion = (mediaCount, driveMediaCount = 0) => {
    const localCount = mediaCount - driveMediaCount;
    if (driveMediaCount === 0) {
        return mediaCount === 1
            ? "The file and its metadata will be permanently removed. This action cannot be undone."
            : `${pluralFiles(mediaCount)} and their metadata will be permanently removed. This action cannot be undone.`;
    }
    if (localCount === 0) {
        return mediaCount === 1
            ? "It will be removed from Tagged with its tags, albums and favourite. The original file stays in your Google Drive."
            : `${mediaCount} media will be removed from Tagged with their tags, albums and favourites. The original files stay in your Google Drive.`;
    }
    return `${mediaCount} media will be removed from Tagged. ${pluralFiles(driveMediaCount)} from Google Drive stay in your Drive; the other ${pluralFiles(localCount)} will be permanently deleted. This action cannot be undone.`;
};
