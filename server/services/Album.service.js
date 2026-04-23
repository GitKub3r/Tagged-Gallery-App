const AlbumModel = require("../models/Album.model");
const MediaAlbumModel = require("../models/MediaAlbum.model");
const MediaModel = require("../models/Media.model");

class AlbumService {
    // ─── CRUD ────────────────────────────────────────────────────────────────

    static async getAll(requestUser) {
        const albums =
            requestUser.type === "admin"
                ? await AlbumModel.findAll()
                : await AlbumModel.findAllByUserId(requestUser.id);
        return { success: true, data: albums };
    }

    static async getById(id, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(id)
                : await AlbumModel.findByIdForUser(id, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }
        return { success: true, data: album };
    }

    static async create(body, requestUser) {
        const albumname = (body.albumname || "").trim();
        if (!albumname) {
            return { success: false, message: "albumname is required" };
        }
        if (albumname.length > 255) {
            return { success: false, message: "albumname must be 255 characters max" };
        }

        const album = await AlbumModel.create(albumname, requestUser.id);
        return { success: true, data: album };
    }

    static async update(id, body, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(id)
                : await AlbumModel.findByIdForUser(id, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const albumname = (body.albumname || "").trim();
        if (!albumname) {
            return { success: false, message: "albumname is required" };
        }
        if (albumname.length > 255) {
            return { success: false, message: "albumname must be 255 characters max" };
        }

        await AlbumModel.update(id, albumname);
        const updated = await AlbumModel.findById(id);
        return { success: true, data: updated };
    }

    static async delete(id, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(id)
                : await AlbumModel.findByIdForUser(id, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        await AlbumModel.delete(id);
        return { success: true, message: "Album deleted" };
    }

    // ─── COVER ───────────────────────────────────────────────────────────────

    static async uploadCover(id, body, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(id)
                : await AlbumModel.findByIdForUser(id, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const mediaId = Number(body.media_id);
        if (!mediaId || !Number.isInteger(mediaId) || mediaId <= 0) {
            return { success: false, message: "media_id must be a positive integer" };
        }

        const media =
            requestUser.type === "admin"
                ? await MediaModel.findById(mediaId)
                : await MediaModel.findByIdForUser(mediaId, requestUser.id);
        if (!media) {
            return { success: false, message: "Media not found" };
        }
        if (requestUser.type !== "admin" && media.user_id !== requestUser.id) {
            return { success: false, message: "Forbidden: media does not belong to you" };
        }
        if (media.mediatype !== "image") {
            return { success: false, message: "Album cover media must be a static image" };
        }

        const coverpath = media.filepath || null;
        const thumbpath = media.thumbpath || null;

        await AlbumModel.updateCover(id, coverpath, thumbpath);

        const updated = await AlbumModel.findById(id);
        return { success: true, data: updated };
    }

    static async deleteCover(id, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(id)
                : await AlbumModel.findByIdForUser(id, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }
        if (!album.albumcoverpath) {
            return { success: false, message: "Album has no cover" };
        }

        await AlbumModel.removeCover(id);

        const updated = await AlbumModel.findById(id);
        return { success: true, data: updated };
    }

    // ─── MEDIA RELATIONS ─────────────────────────────────────────────────────

    static async getMedia(id, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(id)
                : await AlbumModel.findByIdForUser(id, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const media = await MediaAlbumModel.findMediaByAlbumId(id);
        return { success: true, data: media };
    }

    static async addMedia(albumId, body, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(albumId)
                : await AlbumModel.findByIdForUser(albumId, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const mediaId = Number(body.media_id);
        if (!mediaId || !Number.isInteger(mediaId) || mediaId <= 0) {
            return { success: false, message: "media_id must be a positive integer" };
        }

        const media =
            requestUser.type === "admin"
                ? await MediaModel.findById(mediaId)
                : await MediaModel.findByIdForUser(mediaId, requestUser.id);
        if (!media) {
            return { success: false, message: "Media not found" };
        }
        if (requestUser.type !== "admin" && media.user_id !== requestUser.id) {
            return { success: false, message: "Forbidden: media does not belong to you" };
        }

        await MediaAlbumModel.addMany(albumId, [mediaId]);
        const updatedAlbum = await AlbumModel.findById(albumId);
        return { success: true, data: updatedAlbum };
    }

    static async addManyMedia(albumId, body, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(albumId)
                : await AlbumModel.findByIdForUser(albumId, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const rawIds = body.media_ids;
        if (!Array.isArray(rawIds) || rawIds.length === 0) {
            return { success: false, message: "media_ids must be a non-empty array" };
        }

        const mediaIds = rawIds.map(Number);
        if (mediaIds.some((id) => !Number.isInteger(id) || id <= 0)) {
            return { success: false, message: "All media_ids must be positive integers" };
        }

        // Validate all media items exist and belong to the requesting user
        const foundMedia =
            requestUser.type === "admin"
                ? await MediaModel.findByIds(mediaIds)
                : await MediaModel.findByIdsForUser(mediaIds, requestUser.id);
        if (foundMedia.length !== mediaIds.length) {
            const foundIds = new Set(foundMedia.map((m) => m.id));
            const missing = mediaIds.filter((id) => !foundIds.has(id));
            return { success: false, message: `Media not found: ${missing.join(", ")}` };
        }

        const unauthorized = foundMedia.filter((m) => m.user_id !== requestUser.id);
        if (unauthorized.length > 0) {
            return { success: false, message: "Forbidden: some media items do not belong to you" };
        }

        await MediaAlbumModel.addMany(albumId, mediaIds);
        const updatedAlbum = await AlbumModel.findById(albumId);
        return { success: true, data: updatedAlbum };
    }

    static async removeMedia(albumId, mediaId, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(albumId)
                : await AlbumModel.findByIdForUser(albumId, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const id = Number(mediaId);
        if (!id || !Number.isInteger(id) || id <= 0) {
            return { success: false, message: "mediaId must be a positive integer" };
        }

        const removed = await MediaAlbumModel.removeOne(albumId, id);
        if (!removed) {
            return { success: false, message: "Media not found in this album" };
        }

        return { success: true, message: "Media removed from album" };
    }

    static async removeManyMedia(albumId, body, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(albumId)
                : await AlbumModel.findByIdForUser(albumId, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const rawIds = body.media_ids;
        if (!Array.isArray(rawIds) || rawIds.length === 0) {
            return { success: false, message: "media_ids must be a non-empty array" };
        }

        const mediaIds = rawIds.map(Number);
        if (mediaIds.some((id) => !Number.isInteger(id) || id <= 0)) {
            return { success: false, message: "All media_ids must be positive integers" };
        }

        const removed = await MediaAlbumModel.removeMany(albumId, mediaIds);
        return { success: true, removed };
    }

    static async reorderMedia(albumId, body, requestUser) {
        const album =
            requestUser.type === "admin"
                ? await AlbumModel.findById(albumId)
                : await AlbumModel.findByIdForUser(albumId, requestUser.id);
        if (!album) {
            return { success: false, message: "Album not found" };
        }

        const rawIds = body.media_ids;
        if (!Array.isArray(rawIds)) {
            return { success: false, message: "media_ids must be an array" };
        }

        const mediaIds = rawIds.map(Number);
        if (mediaIds.some((id) => !Number.isInteger(id) || id <= 0)) {
            return { success: false, message: "All media_ids must be positive integers" };
        }

        if (new Set(mediaIds).size !== mediaIds.length) {
            return { success: false, message: "media_ids cannot contain duplicates" };
        }

        const currentIds = await MediaAlbumModel.findMediaIdsByAlbumId(albumId);

        if (currentIds.length !== mediaIds.length) {
            return { success: false, message: "media_ids must include all album media items" };
        }

        const currentSet = new Set(currentIds);
        const sameIds = mediaIds.every((id) => currentSet.has(id));

        if (!sameIds) {
            return { success: false, message: "media_ids must match current album media items" };
        }

        await MediaAlbumModel.replaceOrder(albumId, mediaIds);
        const updatedMedia = await MediaAlbumModel.findMediaByAlbumId(albumId);

        return { success: true, data: updatedMedia };
    }
}

module.exports = AlbumService;
