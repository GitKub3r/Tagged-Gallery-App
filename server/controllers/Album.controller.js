const AlbumService = require("../services/Album.service");
const AuditService = require("../services/Audit.service");

class AlbumController {
    static async getAll(req, res) {
        try {
            const result = await AlbumService.getAll(req.user);
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.getAll:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async getById(req, res) {
        try {
            const result = await AlbumService.getById(req.params.id, req.user);
            if (!result.success) return res.status(404).json(result);
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.getById:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async create(req, res) {
        try {
            const result = await AlbumService.create(req.body, req.user);
            if (!result.success) {
                await AuditService.logEvent({
                    actionCode: "ALBUM_CREATE",
                    req,
                    userId: req.user?.id,
                    statusCode: 400,
                    message: result.message || "Create album failed",
                    metadata: {
                        albumname: req.body?.albumname || null,
                    },
                });
                return res.status(400).json(result);
            }

            await AuditService.logEvent({
                actionCode: "ALBUM_CREATE",
                req,
                userId: req.user?.id,
                statusCode: 201,
                message: "Album created successfully",
                metadata: {
                    albumId: result.data?.id || null,
                    albumname: result.data?.albumname || null,
                },
            });
            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in AlbumController.create:", error);
            await AuditService.logEvent({
                actionCode: "ALBUM_CREATE",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async update(req, res) {
        try {
            const result = await AlbumService.update(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message === "Album not found" ? 404 : 400;
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.update:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async delete(req, res) {
        try {
            const result = await AlbumService.delete(req.params.id, req.user);

            if (!result.success) {
                await AuditService.logEvent({
                    actionCode: "ALBUM_DELETE",
                    req,
                    userId: req.user?.id,
                    statusCode: 404,
                    message: result.message || "Album not found",
                    metadata: {
                        albumId: Number(req.params.id),
                    },
                });
                return res.status(404).json(result);
            }

            await AuditService.logEvent({
                actionCode: "ALBUM_DELETE",
                req,
                userId: req.user?.id,
                statusCode: 200,
                message: "Album deleted successfully",
                metadata: {
                    albumId: Number(req.params.id),
                },
            });

            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.delete:", error);
            await AuditService.logEvent({
                actionCode: "ALBUM_DELETE",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    albumId: Number(req.params.id),
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    // ─── COVER ───────────────────────────────────────────────────────────────

    static async uploadCover(req, res) {
        try {
            const result = await AlbumService.uploadCover(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message.startsWith("Forbidden")
                    ? 403
                    : result.message.includes("not found")
                      ? 404
                      : 400;
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.uploadCover:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async deleteCover(req, res) {
        try {
            const result = await AlbumService.deleteCover(req.params.id, req.user);
            if (!result.success) {
                const status = result.message === "Album not found" ? 404 : 400;
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.deleteCover:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    // ─── MEDIA RELATIONS ─────────────────────────────────────────────────────

    static async getMedia(req, res) {
        try {
            const result = await AlbumService.getMedia(req.params.id, req.user);
            if (!result.success) return res.status(404).json(result);
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.getMedia:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async addMedia(req, res) {
        try {
            const result = await AlbumService.addMedia(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message.startsWith("Forbidden")
                    ? 403
                    : result.message.includes("not found")
                      ? 404
                      : 400;
                await AuditService.logEvent({
                    actionCode: "ALBUM_ADD_MEDIA",
                    req,
                    userId: req.user?.id,
                    statusCode: status,
                    message: result.message || "Add media to album failed",
                    metadata: {
                        albumId: Number(req.params.id),
                        mediaId: Number(req.body?.media_id),
                    },
                });
                return res.status(status).json(result);
            }

            await AuditService.logEvent({
                actionCode: "ALBUM_ADD_MEDIA",
                req,
                userId: req.user?.id,
                statusCode: 201,
                message: "Media added to album successfully",
                metadata: {
                    albumId: Number(req.params.id),
                    mediaId: Number(req.body?.media_id),
                },
            });
            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in AlbumController.addMedia:", error);
            await AuditService.logEvent({
                actionCode: "ALBUM_ADD_MEDIA",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    albumId: Number(req.params.id),
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async addManyMedia(req, res) {
        try {
            const requestedMediaIds = Array.isArray(req.body?.media_ids)
                ? [...new Set(req.body.media_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const requestedCount = requestedMediaIds.length;
            const actionCode = requestedCount <= 1 ? "ALBUM_ADD_MEDIA" : "ALBUM_ADD_MEDIA_BATCH";
            const result = await AlbumService.addManyMedia(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message.startsWith("Forbidden")
                    ? 403
                    : result.message.includes("not found")
                      ? 404
                      : 400;
                await AuditService.logEvent({
                    actionCode,
                    req,
                    userId: req.user?.id,
                    statusCode: status,
                    message: result.message || (requestedCount <= 1 ? "Add media to album failed" : "Add multiple media to album failed"),
                    metadata: {
                        albumId: Number(req.params.id),
                        mediaIds: requestedMediaIds,
                        requestedCount,
                    },
                });
                return res.status(status).json(result);
            }

            await AuditService.logEvent({
                actionCode,
                req,
                userId: req.user?.id,
                statusCode: 201,
                message: requestedCount <= 1 ? "Media added to album successfully" : "Multiple media added to album successfully",
                metadata: {
                    albumId: Number(req.params.id),
                    addedCount: requestedCount,
                    mediaIds: requestedMediaIds,
                },
            });
            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in AlbumController.addManyMedia:", error);
            const requestedMediaIds = Array.isArray(req.body?.media_ids)
                ? [...new Set(req.body.media_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const requestedCount = requestedMediaIds.length;
            await AuditService.logEvent({
                actionCode: requestedCount <= 1 ? "ALBUM_ADD_MEDIA" : "ALBUM_ADD_MEDIA_BATCH",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    albumId: Number(req.params.id),
                    mediaIds: requestedMediaIds,
                    requestedCount,
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async removeMedia(req, res) {
        try {
            const result = await AlbumService.removeMedia(req.params.id, req.params.mediaId, req.user);
            if (!result.success) {
                const status = result.message.includes("not found") ? 404 : 400;
                await AuditService.logEvent({
                    actionCode: "ALBUM_REMOVE_MEDIA",
                    req,
                    userId: req.user?.id,
                    statusCode: status,
                    message: result.message || "Remove media from album failed",
                    metadata: {
                        albumId: Number(req.params.id),
                        mediaId: Number(req.params.mediaId),
                    },
                });
                return res.status(status).json(result);
            }

            await AuditService.logEvent({
                actionCode: "ALBUM_REMOVE_MEDIA",
                req,
                userId: req.user?.id,
                statusCode: 200,
                message: "Media removed from album successfully",
                metadata: {
                    albumId: Number(req.params.id),
                    mediaId: Number(req.params.mediaId),
                },
            });
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.removeMedia:", error);
            await AuditService.logEvent({
                actionCode: "ALBUM_REMOVE_MEDIA",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    albumId: Number(req.params.id),
                    mediaId: Number(req.params.mediaId),
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async removeManyMedia(req, res) {
        try {
            const requestedMediaIds = Array.isArray(req.body?.media_ids)
                ? [...new Set(req.body.media_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const requestedCount = requestedMediaIds.length;
            const actionCode = requestedCount <= 1 ? "ALBUM_REMOVE_MEDIA" : "ALBUM_REMOVE_MEDIA_BATCH";
            const result = await AlbumService.removeManyMedia(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message.includes("not found") ? 404 : 400;
                await AuditService.logEvent({
                    actionCode,
                    req,
                    userId: req.user?.id,
                    statusCode: status,
                    message:
                        result.message ||
                        (requestedCount <= 1 ? "Remove media from album failed" : "Remove multiple media from album failed"),
                    metadata: {
                        albumId: Number(req.params.id),
                        mediaIds: requestedMediaIds,
                        requestedCount,
                    },
                });
                return res.status(status).json(result);
            }

            await AuditService.logEvent({
                actionCode,
                req,
                userId: req.user?.id,
                statusCode: 200,
                message:
                    requestedCount <= 1
                        ? "Media removed from album successfully"
                        : "Multiple media removed from album successfully",
                metadata: {
                    albumId: Number(req.params.id),
                    mediaIds: requestedMediaIds,
                    requestedCount,
                    removedCount: Number(result.removed || 0),
                },
            });
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.removeManyMedia:", error);
            const requestedMediaIds = Array.isArray(req.body?.media_ids)
                ? [...new Set(req.body.media_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const requestedCount = requestedMediaIds.length;
            await AuditService.logEvent({
                actionCode: requestedCount <= 1 ? "ALBUM_REMOVE_MEDIA" : "ALBUM_REMOVE_MEDIA_BATCH",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    albumId: Number(req.params.id),
                    mediaIds: requestedMediaIds,
                    requestedCount,
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async reorderMedia(req, res) {
        try {
            const result = await AlbumService.reorderMedia(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message.includes("not found") ? 404 : 400;
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error("Error in AlbumController.reorderMedia:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

module.exports = AlbumController;
