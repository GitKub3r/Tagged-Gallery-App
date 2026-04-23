const fs = require("fs/promises");
const path = require("path");
const MediaModel = require("../models/Media.model");
const TagModel = require("../models/Tag.model");
const MediaTagModel = require("../models/MediaTag.model");
const { detectMediaType, generateThumbnail } = require("../utils/media");
const { MEDIA_UPLOAD_DIR, THUMBNAILS_UPLOAD_DIR } = require("../middlewares/upload.middleware");

const DEFAULT_TAG_COLOR = "#643aff";

const removeFileIfExists = async (filePath) => {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(`Could not delete file ${filePath}:`, error.message);
        }
    }
};

class MediaService {
    static normalizeOptionalText(value) {
        if (value === undefined || value === null) {
            return null;
        }

        const trimmed = String(value).trim();
        return trimmed || null;
    }

    static validateManagedValue(value, fieldLabel, maxLength = 255) {
        const trimmed = String(value || "").trim();

        if (!trimmed) {
            return {
                success: false,
                message: `${fieldLabel} is required`,
            };
        }

        if (trimmed.length > maxLength) {
            return {
                success: false,
                message: `${fieldLabel} must be ${maxLength} characters max`,
            };
        }

        return { success: true, data: trimmed };
    }

    static validateCommonFields(payload) {
        if (payload?.displayname !== undefined && typeof payload.displayname !== "string") {
            return {
                success: false,
                message: "displayname must be a string",
            };
        }

        return { success: true };
    }

    static parseTagNames(rawTagNames) {
        if (rawTagNames === undefined || rawTagNames === null || rawTagNames === "") {
            return { success: true, data: [] };
        }

        let parsed;

        if (Array.isArray(rawTagNames)) {
            parsed = rawTagNames;
        } else if (typeof rawTagNames === "string") {
            const trimmed = rawTagNames.trim();
            if (!trimmed) {
                return { success: true, data: [] };
            }

            if (trimmed.startsWith("[")) {
                try {
                    parsed = JSON.parse(trimmed);
                } catch (error) {
                    return {
                        success: false,
                        message: "tag_names must be a valid JSON array or comma separated string",
                    };
                }
            } else {
                parsed = trimmed.split(",");
            }
        } else {
            return {
                success: false,
                message: "tag_names must be a string or array",
            };
        }

        if (!Array.isArray(parsed)) {
            return {
                success: false,
                message: "tag_names must be an array",
            };
        }

        const deduped = [];
        const used = new Set();

        for (const rawName of parsed) {
            const name = String(rawName || "").trim();
            if (!name) {
                continue;
            }

            if (name.length > 100) {
                return {
                    success: false,
                    message: "Each tag name must be 100 characters max",
                };
            }

            const normalized = name.toLowerCase();
            if (!used.has(normalized)) {
                used.add(normalized);
                deduped.push(name);
            }
        }

        if (deduped.length > 50) {
            return {
                success: false,
                message: "A media item can have a maximum of 50 tags",
            };
        }

        return { success: true, data: deduped };
    }

    static async getOrCreateTagIdsForUser(tagNames, userId) {
        const tagIds = [];

        for (const tagName of tagNames) {
            let tag = await TagModel.findByTagnameForUser(tagName, userId);

            if (!tag) {
                try {
                    tag = await TagModel.create({
                        user_id: userId,
                        tagname: tagName,
                        tagcolor_hex: DEFAULT_TAG_COLOR,
                        type: "default",
                    });
                } catch (error) {
                    if (error.code === "ER_DUP_ENTRY") {
                        tag = await TagModel.findByTagnameForUser(tagName, userId);
                    } else {
                        throw error;
                    }
                }
            }

            if (tag && tag.id) {
                tagIds.push(tag.id);
            }
        }

        return tagIds;
    }

    static async attachTagsToMedia(mediaId, tagNames, userId) {
        if (!tagNames.length) {
            return;
        }

        const tagIds = await this.getOrCreateTagIdsForUser(tagNames, userId);
        await MediaTagModel.createMany(mediaId, tagIds);
    }

    static mapTagsByMediaId(tagRows) {
        const tagsByMediaId = new Map();

        for (const row of tagRows) {
            if (!tagsByMediaId.has(row.mediaid)) {
                tagsByMediaId.set(row.mediaid, []);
            }

            tagsByMediaId.get(row.mediaid).push({
                id: row.id,
                user_id: row.user_id,
                tagname: row.tagname,
                tagcolor_hex: row.tagcolor_hex,
                type: row.type,
            });
        }

        return tagsByMediaId;
    }

    static async enrichMediaListWithTags(items) {
        if (!items || items.length === 0) {
            return [];
        }

        const mediaIds = items.map((item) => item.id);
        const tagRows = await TagModel.findByMediaIds(mediaIds);
        const tagsByMediaId = this.mapTagsByMediaId(tagRows);

        return items.map((item) => ({
            ...item,
            tags: tagsByMediaId.get(item.id) || [],
        }));
    }

    static async enrichMediaWithTags(item) {
        if (!item) {
            return item;
        }

        const tagRows = await TagModel.findByMediaId(item.id);
        const tags = tagRows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            tagname: row.tagname,
            tagcolor_hex: row.tagcolor_hex,
            type: row.type,
        }));

        return {
            ...item,
            tags,
        };
    }

    static async getAll(requestUser, page = 1, limit = 20) {
        try {
            const parsedPage = Math.max(1, Number(page) || 1);
            const parsedLimit = Math.min(10000, Math.max(1, Number(limit) || 20));

            let items, total;

            if (requestUser.type === "admin") {
                [items, total] = await Promise.all([
                    MediaModel.findAllPaginated(parsedPage, parsedLimit),
                    MediaModel.countAll(),
                ]);
            } else {
                [items, total] = await Promise.all([
                    MediaModel.findAllByUserIdPaginated(requestUser.id, parsedPage, parsedLimit),
                    MediaModel.countByUserId(requestUser.id),
                ]);
            }

            const enrichedItems = await this.enrichMediaListWithTags(items);

            return {
                success: true,
                data: enrichedItems,
                total,
                page: parsedPage,
                limit: parsedLimit,
            };
        } catch (error) {
            console.error("Error in MediaService.getAll:", error);
            throw new Error("Error fetching media items");
        }
    }

    static async getDistinctDisplayNames(requestUser) {
        try {
            const rows =
                requestUser.type === "admin"
                    ? await MediaModel.findDistinctDisplayNames()
                    : await MediaModel.findDistinctDisplayNamesByUserId(requestUser.id);

            return {
                success: true,
                data: rows.map((row) => row.displayname),
            };
        } catch (error) {
            console.error("Error in MediaService.getDistinctDisplayNames:", error);
            throw new Error("Error fetching distinct display names");
        }
    }

    static async getDistinctAuthors(requestUser) {
        try {
            const rows =
                requestUser.type === "admin"
                    ? await MediaModel.findDistinctAuthors()
                    : await MediaModel.findDistinctAuthorsByUserId(requestUser.id);

            return {
                success: true,
                data: rows.map((row) => row.author),
            };
        } catch (error) {
            console.error("Error in MediaService.getDistinctAuthors:", error);
            throw new Error("Error fetching distinct authors");
        }
    }

    static async createDisplayName(payload, requestUser) {
        try {
            const validation = this.validateManagedValue(payload?.displayname, "displayname");
            if (!validation.success) {
                return validation;
            }

            await MediaModel.createManagedDisplayName(requestUser.id, validation.data);
            return {
                success: true,
                data: { displayname: validation.data },
                message: "Display name created successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.createDisplayName:", error);
            throw new Error("Error creating display name");
        }
    }

    static async updateDisplayName(payload, requestUser) {
        try {
            const previousValidation = this.validateManagedValue(payload?.previousValue, "previousValue");
            if (!previousValidation.success) {
                return previousValidation;
            }

            const nextValidation = this.validateManagedValue(payload?.nextValue, "nextValue");
            if (!nextValidation.success) {
                return nextValidation;
            }

            const previousValue = previousValidation.data;
            const nextValue = nextValidation.data;

            if (previousValue === nextValue) {
                return { success: false, message: "No changes were made" };
            }

            const affectedCount =
                requestUser.type === "admin"
                    ? await MediaModel.renameManagedDisplayName(previousValue, nextValue)
                    : await MediaModel.renameManagedDisplayNameForUser(requestUser.id, previousValue, nextValue);

            return {
                success: true,
                data: { displayname: nextValue, affectedCount },
                message: "Display name updated successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.updateDisplayName:", error);
            throw new Error("Error updating display name");
        }
    }

    static async deleteDisplayName(payload, requestUser) {
        try {
            const validation = this.validateManagedValue(payload?.value, "value");
            if (!validation.success) {
                return validation;
            }

            const value = validation.data;
            const affectedCount =
                requestUser.type === "admin"
                    ? await MediaModel.deleteManagedDisplayName(value)
                    : await MediaModel.deleteManagedDisplayNameForUser(requestUser.id, value);

            return {
                success: true,
                data: { value, affectedCount },
                message: "Display name deleted successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.deleteDisplayName:", error);
            throw new Error("Error deleting display name");
        }
    }

    static async createAuthor(payload, requestUser) {
        try {
            const validation = this.validateManagedValue(payload?.author, "author", 100);
            if (!validation.success) {
                return validation;
            }

            await MediaModel.createManagedAuthor(requestUser.id, validation.data);
            return {
                success: true,
                data: { author: validation.data },
                message: "Author created successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.createAuthor:", error);
            throw new Error("Error creating author");
        }
    }

    static async updateAuthor(payload, requestUser) {
        try {
            const previousValidation = this.validateManagedValue(payload?.previousValue, "previousValue", 100);
            if (!previousValidation.success) {
                return previousValidation;
            }

            const nextValidation = this.validateManagedValue(payload?.nextValue, "nextValue", 100);
            if (!nextValidation.success) {
                return nextValidation;
            }

            const previousValue = previousValidation.data;
            const nextValue = nextValidation.data;

            if (previousValue === nextValue) {
                return { success: false, message: "No changes were made" };
            }

            const affectedCount =
                requestUser.type === "admin"
                    ? await MediaModel.renameManagedAuthor(previousValue, nextValue)
                    : await MediaModel.renameManagedAuthorForUser(requestUser.id, previousValue, nextValue);

            return {
                success: true,
                data: { author: nextValue, affectedCount },
                message: "Author updated successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.updateAuthor:", error);
            throw new Error("Error updating author");
        }
    }

    static async deleteAuthor(payload, requestUser) {
        try {
            const validation = this.validateManagedValue(payload?.value, "value", 100);
            if (!validation.success) {
                return validation;
            }

            const value = validation.data;
            const affectedCount =
                requestUser.type === "admin"
                    ? await MediaModel.deleteManagedAuthor(value)
                    : await MediaModel.deleteManagedAuthorForUser(requestUser.id, value);

            return {
                success: true,
                data: { value, affectedCount },
                message: "Author deleted successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.deleteAuthor:", error);
            throw new Error("Error deleting author");
        }
    }

    static async getById(id, requestUser) {
        try {
            const item =
                requestUser.type === "admin"
                    ? await MediaModel.findById(id)
                    : await MediaModel.findByIdForUser(id, requestUser.id);
            if (!item) {
                return {
                    success: false,
                    message: "Media not found",
                };
            }

            const enrichedItem = await this.enrichMediaWithTags(item);

            return {
                success: true,
                data: enrichedItem,
            };
        } catch (error) {
            console.error("Error in MediaService.getById:", error);
            throw new Error("Error fetching media item");
        }
    }

    static async uploadSingle(file, payload, userId) {
        if (!file) {
            return {
                success: false,
                message: "File is required",
            };
        }

        const validation = this.validateCommonFields(payload);
        if (!validation.success) {
            await removeFileIfExists(file.path);
            return validation;
        }

        const parsedTagNames = this.parseTagNames(payload.tag_names);
        if (!parsedTagNames.success) {
            await removeFileIfExists(file.path);
            return parsedTagNames;
        }

        let createdMedia = null;

        try {
            const mediatype = detectMediaType(file.mimetype);
            const thumbnail = await generateThumbnail(file, mediatype);
            const normalizedDisplayName = this.normalizeOptionalText(payload.displayname);
            const normalizedAuthor = this.normalizeOptionalText(payload.author);

            const mediaData = {
                user_id: userId,
                displayname: normalizedDisplayName,
                author: normalizedAuthor,
                filename: file.filename,
                size: file.size,
                filepath: `/uploads/media/${file.filename}`,
                thumbpath: thumbnail.thumbnailPath,
                mediatype,
                is_favourite: false,
            };

            createdMedia = await MediaModel.create(mediaData);
            await this.attachTagsToMedia(createdMedia.id, parsedTagNames.data, userId);

            const created = await MediaModel.findById(createdMedia.id);

            return {
                success: true,
                data: created,
                message: "Media uploaded successfully",
            };
        } catch (error) {
            if (createdMedia?.id) {
                await MediaModel.delete(createdMedia.id);
            }

            await removeFileIfExists(file.path);
            const thumbnailPath = path.join(THUMBNAILS_UPLOAD_DIR, `${path.parse(file.filename).name}.jpg`);
            await removeFileIfExists(thumbnailPath);

            console.error("Error in uploadSingle:", error);
            throw new Error("Error uploading media");
        }
    }

    static async uploadMany(files, payload, userId) {
        if (!files || files.length === 0) {
            return {
                success: false,
                message: "At least one file is required",
            };
        }

        const validation = this.validateCommonFields(payload);
        if (!validation.success) {
            await Promise.all(files.map((file) => removeFileIfExists(file.path)));
            return validation;
        }

        const parsedTagNames = this.parseTagNames(payload.tag_names);
        if (!parsedTagNames.success) {
            await Promise.all(files.map((file) => removeFileIfExists(file.path)));
            return parsedTagNames;
        }

        const processedFiles = [];
        let createdItems = [];

        try {
            const normalizedDisplayName = this.normalizeOptionalText(payload.displayname);
            const normalizedAuthor = this.normalizeOptionalText(payload.author);

            for (const file of files) {
                const mediatype = detectMediaType(file.mimetype);
                const thumbnail = await generateThumbnail(file, mediatype);

                processedFiles.push({
                    user_id: userId,
                    displayname: normalizedDisplayName,
                    author: normalizedAuthor,
                    filename: file.filename,
                    size: file.size,
                    filepath: `/uploads/media/${file.filename}`,
                    thumbpath: thumbnail.thumbnailPath,
                    mediatype,
                    is_favourite: false,
                });
            }

            createdItems = await MediaModel.createMany(processedFiles);

            if (parsedTagNames.data.length > 0) {
                const tagIds = await this.getOrCreateTagIdsForUser(parsedTagNames.data, userId);

                for (const mediaItem of createdItems) {
                    await MediaTagModel.createMany(mediaItem.id, tagIds);
                }
            }

            const createdIds = createdItems.map((item) => item.id);
            const refreshedItems = [];

            for (const id of createdIds) {
                const mediaItem = await MediaModel.findById(id);
                if (mediaItem) {
                    refreshedItems.push(mediaItem);
                }
            }

            return {
                success: true,
                data: refreshedItems,
                message: "Media files uploaded successfully",
            };
        } catch (error) {
            console.error("Error in uploadMany:", error);

            if (createdItems.length > 0) {
                await MediaModel.deleteMany(createdItems.map((item) => item.id));
            }

            await Promise.all(
                files.map(async (file) => {
                    await removeFileIfExists(path.join(MEDIA_UPLOAD_DIR, file.filename));
                    await removeFileIfExists(path.join(THUMBNAILS_UPLOAD_DIR, `${path.parse(file.filename).name}.jpg`));
                }),
            );

            throw new Error("Error uploading media files");
        }
    }

    static async update(id, payload, requestUser) {
        try {
            const existing =
                requestUser.type === "admin"
                    ? await MediaModel.findById(id)
                    : await MediaModel.findByIdForUser(id, requestUser.id);
            if (!existing) {
                return { success: false, message: "Media not found" };
            }

            const fields = {};
            let parsedTagNames = null;
            const shouldUpdateTags = payload.tag_names !== undefined;
            let tagsToAdd = null;
            let tagsToRemove = null;
            const shouldAddOrRemoveTags = payload.tags_to_add !== undefined || payload.tags_to_remove !== undefined;

            if (payload.displayname !== undefined) {
                const trimmed = String(payload.displayname).trim();
                if (trimmed !== "") {
                    fields.displayname = trimmed;
                }
                // Si string vacío, no actualizar displayname (conservar valor original)
            }

            if (payload.author !== undefined) {
                const trimmed = String(payload.author).trim();
                if (trimmed !== "") {
                    fields.author = trimmed;
                } else {
                    fields.author = null;
                }
            }

            if (shouldUpdateTags) {
                parsedTagNames = this.parseTagNames(payload.tag_names);

                if (!parsedTagNames.success) {
                    return parsedTagNames;
                }
            }

            if (shouldAddOrRemoveTags) {
                if (payload.tags_to_add !== undefined) {
                    tagsToAdd = this.parseTagNames(payload.tags_to_add);
                    if (!tagsToAdd.success) return tagsToAdd;
                }

                if (payload.tags_to_remove !== undefined) {
                    tagsToRemove = this.parseTagNames(payload.tags_to_remove);
                    if (!tagsToRemove.success) return tagsToRemove;
                }
            }

            const shouldUpdateMediaFields = Object.keys(fields).length > 0;

            if (!shouldUpdateMediaFields && !shouldUpdateTags && !shouldAddOrRemoveTags) {
                return { success: false, message: "No changes were made" };
            }

            if (shouldUpdateMediaFields) {
                const updated = await MediaModel.update(id, fields);

                if (!updated && !shouldUpdateTags && !shouldAddOrRemoveTags) {
                    return { success: false, message: "No changes were made" };
                }
            }

            if (shouldUpdateTags) {
                await MediaTagModel.deleteTagsByMediaId(id, existing.user_id);
                await this.attachTagsToMedia(id, parsedTagNames.data, existing.user_id);
            } else if (shouldAddOrRemoveTags) {
                if (tagsToRemove && tagsToRemove.data.length > 0) {
                    await MediaTagModel.deleteSpecificTagsByNameForMedia(id, tagsToRemove.data, existing.user_id);
                }

                if (tagsToAdd && tagsToAdd.data.length > 0) {
                    await this.attachTagsToMedia(id, tagsToAdd.data, existing.user_id);
                }
            }

            const updatedMedia = await MediaModel.findById(id);
            const enrichedUpdatedMedia = await this.enrichMediaWithTags(updatedMedia);

            return { success: true, data: enrichedUpdatedMedia, message: "Media updated successfully" };
        } catch (error) {
            console.error("Error in MediaService.update:", error);
            throw new Error("Error updating media");
        }
    }

    static async delete(id, requestUser) {
        try {
            const existing =
                requestUser.type === "admin"
                    ? await MediaModel.findById(id)
                    : await MediaModel.findByIdForUser(id, requestUser.id);
            if (!existing) {
                return { success: false, message: "Media not found" };
            }

            await MediaModel.delete(id);

            const mediaFilePath = path.join(MEDIA_UPLOAD_DIR, existing.filename);
            const thumbFilename = `${path.parse(existing.filename).name}.jpg`;
            const thumbFilePath = path.join(THUMBNAILS_UPLOAD_DIR, thumbFilename);

            await removeFileIfExists(mediaFilePath);
            await removeFileIfExists(thumbFilePath);

            return { success: true, message: "Media deleted successfully" };
        } catch (error) {
            console.error("Error in MediaService.delete:", error);
            throw new Error("Error deleting media");
        }
    }

    static async deleteMany(ids, requestUser) {
        try {
            if (!Array.isArray(ids) || ids.length === 0) {
                return {
                    success: false,
                    message: "ids must be a non-empty array",
                };
            }

            const normalizedIds = [
                ...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
            ];

            if (normalizedIds.length === 0) {
                return {
                    success: false,
                    message: "ids must contain valid positive integers",
                };
            }

            const items =
                requestUser.type === "admin"
                    ? await MediaModel.findByIds(normalizedIds)
                    : await MediaModel.findByIdsForUser(normalizedIds, requestUser.id);

            if (items.length === 0) {
                return {
                    success: false,
                    message: "No media found for the provided ids",
                };
            }

            await MediaModel.deleteMany(items.map((item) => item.id));

            await Promise.all(
                items.flatMap((item) => {
                    const mediaFilePath = path.join(MEDIA_UPLOAD_DIR, item.filename);
                    const thumbFilename = `${path.parse(item.filename).name}.jpg`;
                    const thumbFilePath = path.join(THUMBNAILS_UPLOAD_DIR, thumbFilename);

                    return [removeFileIfExists(mediaFilePath), removeFileIfExists(thumbFilePath)];
                }),
            );

            return {
                success: true,
                data: {
                    deletedIds: items.map((item) => item.id),
                    deletedCount: items.length,
                },
                message: "Media deleted successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.deleteMany:", error);
            throw new Error("Error deleting media items");
        }
    }

    static async toggleFavourite(id, requestUser) {
        try {
            const existing =
                requestUser.type === "admin"
                    ? await MediaModel.findById(id)
                    : await MediaModel.findByIdForUser(id, requestUser.id);

            if (!existing) {
                return { success: false, message: "Media not found" };
            }

            await MediaModel.toggleFavourite(id);
            const updatedMedia = await MediaModel.findById(id);

            return {
                success: true,
                data: updatedMedia,
                message: "Media favourite status toggled successfully",
            };
        } catch (error) {
            console.error("Error in MediaService.toggleFavourite:", error);
            throw new Error("Error toggling media favourite status");
        }
    }
}

module.exports = MediaService;
