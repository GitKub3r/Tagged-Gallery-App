const TagModel = require("../models/Tag.model");
const MediaModel = require("../models/Media.model");
const MediaTagModel = require("../models/MediaTag.model");
const AuditService = require("./Audit.service");
const { DRIVE_TAG_NAME, isDriveTagName } = require("../utils/driveTag");

// Tipos de metadato de la página Metadata: tags, nombres de media y autores.
const KINDS = {
    tags: { maxLength: 100, label: "tag" },
    displaynames: { maxLength: 255, label: "media name", field: "displayname" },
    authors: { maxLength: 100, label: "author", field: "author" },
};

const forbidAdmin = (user) => (user.type === "admin" ? { error: "Metadata is only available for library accounts", status: 403 } : null);

const parseRequest = (kind, rawValue, user) => {
    const forbidden = forbidAdmin(user);
    if (forbidden) return forbidden;
    const config = KINDS[kind];
    if (!config) return { error: "Unknown metadata type", status: 404 };
    const value = String(rawValue ?? "").trim();
    if (!value || value.length > config.maxLength) return { error: `Choose a ${config.label}`, status: 400 };
    return { config, value };
};

// Tag del usuario por nombre. La tag de sistema "Google Drive" no se puede quitar de sus medias.
const findTag = async (value, user) => {
    const tag = await TagModel.findByTagnameForUser(value, user.id);
    if (!tag) return { error: "Tag not found", status: 404 };
    if (isDriveTagName(tag.tagname)) return { error: `The "${DRIVE_TAG_NAME}" tag is managed by Tagged and can't be removed from its media`, status: 409 };
    return { tag };
};

class MetadataService {
    // Cuántas medias activas usan un valor: se enseña antes de quitarlo de todas.
    static async getMediaCount(kind, value, user) {
        const { config, value: parsedValue, ...error } = parseRequest(kind, value, user);
        if (!config) return error;

        if (kind === "tags") {
            const { tag, ...tagError } = await findTag(parsedValue, user);
            if (!tag) return tagError;
            return { data: { mediaCount: await MediaTagModel.countActiveMediaWithTag(tag.id, user.id) } };
        }
        return { data: { mediaCount: await MediaModel.countActiveByValue(user.id, config.field, parsedValue) } };
    }

    // Quita un valor de todas las medias activas. Una tag se conserva en la biblioteca; un nombre de media o un
    // autor desaparece, porque solo existe mientras alguna media lo usa.
    static async removeFromAllMedia(kind, value, user, req) {
        const { config, value: parsedValue, ...error } = parseRequest(kind, value, user);
        if (!config) return error;

        let removedCount;
        if (kind === "tags") {
            const { tag, ...tagError } = await findTag(parsedValue, user);
            if (!tag) return tagError;
            removedCount = await MediaTagModel.removeTagFromActiveMedia(tag.id, user.id);
        } else {
            removedCount = await MediaModel.clearValueFromActiveMedia(user.id, config.field, parsedValue);
        }

        await AuditService.logEvent({
            actionCode: "METADATA_REMOVE_FROM_MEDIA",
            req,
            statusCode: 200,
            message: `Removed ${config.label} "${parsedValue}" from ${removedCount} media`,
            metadata: { kind, value: parsedValue, removedCount },
        });
        return { data: { removedCount } };
    }
}

module.exports = MetadataService;
