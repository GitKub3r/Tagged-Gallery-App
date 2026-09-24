// Tag de sistema que llevan todas las medias de Google Drive. Se añade sola al vincularlas y no se puede quitar
// de una media de Drive, ni poner a una media local, ni renombrar o borrar desde la gestión de tags.
const DRIVE_TAG_NAME = "Google Drive";

const isDriveTagName = (tagName) => String(tagName || "").trim().toLowerCase() === DRIVE_TAG_NAME.toLowerCase();

const withoutDriveTag = (tagNames) => tagNames.filter((tagName) => !isDriveTagName(tagName));

const withDriveTag = (tagNames) => [DRIVE_TAG_NAME, ...withoutDriveTag(tagNames)];

// Ajusta las tags pedidas según el origen de la media.
const enforceDriveTag = (tagNames, isDriveMedia) => (isDriveMedia ? withDriveTag(tagNames) : withoutDriveTag(tagNames));

module.exports = { DRIVE_TAG_NAME, isDriveTagName, withoutDriveTag, withDriveTag, enforceDriveTag };
