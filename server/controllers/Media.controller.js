const MediaService = require("../services/Media.service");
const AuditService = require("../services/Audit.service");

class MediaController {
    static async getAll(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await MediaService.getAll(req.user, page, limit);
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.getAll:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async getDistinctDisplayNames(req, res) {
        try {
            const result = await MediaService.getDistinctDisplayNames(req.user);
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.getDistinctDisplayNames:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async getDistinctAuthors(req, res) {
        try {
            const result = await MediaService.getDistinctAuthors(req.user);
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.getDistinctAuthors:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async createDisplayName(req, res) {
        try {
            const result = await MediaService.createDisplayName(req.body, req.user);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in MediaController.createDisplayName:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async updateDisplayName(req, res) {
        try {
            const result = await MediaService.updateDisplayName(req.body, req.user);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.updateDisplayName:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async deleteDisplayName(req, res) {
        try {
            const result = await MediaService.deleteDisplayName(req.body, req.user);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.deleteDisplayName:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async createAuthor(req, res) {
        try {
            const result = await MediaService.createAuthor(req.body, req.user);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in MediaController.createAuthor:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async updateAuthor(req, res) {
        try {
            const result = await MediaService.updateAuthor(req.body, req.user);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.updateAuthor:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async deleteAuthor(req, res) {
        try {
            const result = await MediaService.deleteAuthor(req.body, req.user);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.deleteAuthor:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async getById(req, res) {
        try {
            const result = await MediaService.getById(req.params.id, req.user);
            if (!result.success) {
                return res.status(404).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.getById:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async uploadSingle(req, res) {
        try {
            const result = await MediaService.uploadSingle(req.file, req.body, req.user.id);

            if (!result.success) {
                await AuditService.logEvent({
                    actionCode: "MEDIA_UPLOAD_SINGLE",
                    req,
                    userId: req.user?.id,
                    statusCode: 400,
                    message: result.message || "Upload media failed",
                });
                return res.status(400).json(result);
            }

            await AuditService.logEvent({
                actionCode: "MEDIA_UPLOAD_SINGLE",
                req,
                userId: req.user?.id,
                statusCode: 201,
                message: "Media uploaded successfully",
                metadata: {
                    mediaId: result.data?.id || null,
                    filename: result.data?.filename || null,
                },
            });

            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in MediaController.uploadSingle:", error);
            await AuditService.logEvent({
                actionCode: "MEDIA_UPLOAD_SINGLE",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
            });
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async uploadMany(req, res) {
        try {
            const result = await MediaService.uploadMany(req.files, req.body, req.user.id);

            if (!result.success) {
                await AuditService.logEvent({
                    actionCode: "MEDIA_UPLOAD_MANY",
                    req,
                    userId: req.user?.id,
                    statusCode: 400,
                    message: result.message || "Upload multiple media failed",
                });
                return res.status(400).json(result);
            }

            await AuditService.logEvent({
                actionCode: "MEDIA_UPLOAD_MANY",
                req,
                userId: req.user?.id,
                statusCode: 201,
                message: "Multiple media uploaded successfully",
                metadata: {
                    createdCount: Array.isArray(result.data) ? result.data.length : 0,
                },
            });

            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in MediaController.uploadMany:", error);
            await AuditService.logEvent({
                actionCode: "MEDIA_UPLOAD_MANY",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
            });
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async update(req, res) {
        try {
            const result = await MediaService.update(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message === "Media not found" ? 404 : 400;
                await AuditService.logEvent({
                    actionCode: "MEDIA_UPDATE",
                    req,
                    userId: req.user?.id,
                    statusCode: status,
                    message: result.message || "Update media failed",
                    metadata: {
                        mediaId: Number(req.params.id),
                    },
                });
                return res.status(status).json(result);
            }

            await AuditService.logEvent({
                actionCode: "MEDIA_UPDATE",
                req,
                userId: req.user?.id,
                statusCode: 200,
                message: "Media updated successfully",
                metadata: {
                    mediaId: Number(req.params.id),
                },
            });
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.update:", error);
            await AuditService.logEvent({
                actionCode: "MEDIA_UPDATE",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    mediaId: Number(req.params.id),
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async delete(req, res) {
        try {
            const result = await MediaService.delete(req.params.id, req.user);
            if (!result.success) {
                await AuditService.logEvent({
                    actionCode: "MEDIA_DELETE",
                    req,
                    userId: req.user?.id,
                    statusCode: 404,
                    message: result.message || "Media not found",
                    metadata: {
                        mediaId: Number(req.params.id),
                    },
                });
                return res.status(404).json(result);
            }

            await AuditService.logEvent({
                actionCode: "MEDIA_DELETE",
                req,
                userId: req.user?.id,
                statusCode: 200,
                message: "Media deleted successfully",
                metadata: {
                    mediaId: Number(req.params.id),
                },
            });
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.delete:", error);
            await AuditService.logEvent({
                actionCode: "MEDIA_DELETE",
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    mediaId: Number(req.params.id),
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async deleteMany(req, res) {
        try {
            const result = await MediaService.deleteMany(req.body.ids, req.user);
            const requestedIds = Array.isArray(req.body?.ids)
                ? [...new Set(req.body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const requestedCount = requestedIds.length;

            if (!result.success) {
                const actionCode = requestedCount <= 1 ? "MEDIA_DELETE" : "MEDIA_DELETE_MANY";
                await AuditService.logEvent({
                    actionCode,
                    req,
                    userId: req.user?.id,
                    statusCode: 400,
                    message: result.message || "Delete multiple media failed",
                    metadata: {
                        ids: requestedIds,
                        requestedCount,
                    },
                });
                return res.status(400).json(result);
            }

            const deletedCount = Number(result.data?.deletedCount || 0);
            const actionCode = deletedCount <= 1 ? "MEDIA_DELETE" : "MEDIA_DELETE_MANY";
            await AuditService.logEvent({
                actionCode,
                req,
                userId: req.user?.id,
                statusCode: 200,
                message: deletedCount <= 1 ? "Media deleted successfully" : "Multiple media deleted successfully",
                metadata: {
                    deletedCount,
                    deletedIds: Array.isArray(result.data?.deletedIds) ? result.data.deletedIds : [],
                },
            });

            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.deleteMany:", error);
            const requestedIds = Array.isArray(req.body?.ids)
                ? [...new Set(req.body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
                : [];
            const requestedCount = requestedIds.length;
            const actionCode = requestedCount <= 1 ? "MEDIA_DELETE" : "MEDIA_DELETE_MANY";
            await AuditService.logEvent({
                actionCode,
                req,
                userId: req.user?.id,
                statusCode: 500,
                message: "Internal server error",
                metadata: {
                    ids: requestedIds,
                    requestedCount,
                },
            });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async toggleFavourite(req, res) {
        try {
            const result = await MediaService.toggleFavourite(req.params.id, req.user);
            if (!result.success) return res.status(404).json(result);
            return res.json(result);
        } catch (error) {
            console.error("Error in MediaController.toggleFavourite:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

module.exports = MediaController;
