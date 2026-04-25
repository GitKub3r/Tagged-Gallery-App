const ActionModel = require("../models/Action.model");
const HistoryModel = require("../models/History.model");

const DEFAULT_ACTION_NAMES = {
    AUTH_UNAUTHORIZED: "Unauthorized access",
    AUTH_FORBIDDEN: "Forbidden action",
    ROUTE_NOT_FOUND: "Resource not found",
    MEDIA_UPLOAD_SINGLE: "Upload media",
    MEDIA_UPLOAD_MANY: "Upload multiple media",
    MEDIA_UPDATE: "Edit media",
    MEDIA_DELETE: "Delete media",
    MEDIA_DELETE_MANY: "Delete multiple media",
    ALBUM_CREATE: "Create album",
    ALBUM_DELETE: "Delete album",
    ALBUM_ADD_MEDIA: "Add media to album",
    ALBUM_ADD_MEDIA_BATCH: "Add multiple media to album",
    ALBUM_REMOVE_MEDIA: "Remove media from album",
    ALBUM_REMOVE_MEDIA_BATCH: "Remove multiple media from album",
    BACKUP_DOWNLOAD_STARTED: "Backup download started",
    BACKUP_DOWNLOAD_CANCEL_REQUESTED: "Backup download cancel requested",
    BACKUP_DOWNLOAD_CANCELLED: "Backup download cancelled",
    BACKUP_DOWNLOAD_SUCCEEDED: "Backup download succeeded",
    BACKUP_DOWNLOAD_FAILED: "Backup download failed",
};

class AuditService {
    static prettifyCode(actionCode) {
        return String(actionCode || "ACTION")
            .toLowerCase()
            .split("_")
            .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
            .join(" ");
    }

    static getClientIp(req) {
        const forwarded = req?.headers?.["x-forwarded-for"];
        if (forwarded && typeof forwarded === "string") {
            return forwarded.split(",")[0].trim();
        }

        return req?.socket?.remoteAddress || req?.ip || null;
    }

    static async ensureAction(actionCode) {
        if (!actionCode) {
            return null;
        }

        const normalizedCode = String(actionCode).trim().toUpperCase();
        if (!normalizedCode) {
            return null;
        }

        let action = await ActionModel.findByCode(normalizedCode);

        if (!action) {
            try {
                action = await ActionModel.create({
                    actionname: DEFAULT_ACTION_NAMES[normalizedCode] || this.prettifyCode(normalizedCode),
                    actioncode: normalizedCode,
                    description: null,
                    is_active: true,
                });
            } catch (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    action = await ActionModel.findByCode(normalizedCode);
                } else {
                    throw error;
                }
            }
        }

        return action;
    }

    static async logEvent({
        actionCode,
        req = null,
        userId = null,
        statusCode = 200,
        message = null,
        metadata = null,
    }) {
        try {
            const action = await this.ensureAction(actionCode);

            const entry = {
                actionid: action?.id || null,
                action_code: actionCode ? String(actionCode).trim().toUpperCase() : null,
                userid: userId ?? req?.user?.id ?? null,
                status_code: Number(statusCode) || 500,
                message: message ? String(message) : null,
                request_method: req?.method || null,
                request_path: req?.originalUrl || req?.url || null,
                ip_address: this.getClientIp(req),
                user_agent: req?.headers?.["user-agent"] || null,
                metadata: metadata || null,
            };

            await HistoryModel.create(entry);
        } catch (error) {
            console.error("AuditService.logEvent failed:", error.message);
        }
    }
}

module.exports = AuditService;
