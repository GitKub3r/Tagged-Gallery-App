const GoogleDriveService = require("../services/GoogleDrive.service");
const { verifyDriveThumbnailRequest } = require("../utils/uploadUrls");

const handleError = (error, res) => {
    console.error("Google Drive request failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

const sendResult = (res, result) =>
    result.error
        ? res.status(result.status).json({ success: false, message: result.error })
        : res.json({ success: true, data: result.data });

class GoogleDriveController {
    static async getStatus(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.getStatus(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async connect(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.connect(req.body?.code, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async getSummary(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.getSummary(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async browse(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.browse(req.query, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    // Sin authenticate (lo pide un <img>): la firma identifica al usuario, el archivo y la versión.
    static async getBrowseThumbnail(req, res) {
        const { userId, fileId } = req.params;
        const { v: version, exp, sig } = req.query;
        const verification = verifyDriveThumbnailRequest(userId, fileId, version, exp, sig);
        if (!verification.valid) return res.status(403).json({ success: false, message: "Invalid or expired file link" });

        try {
            const result = await GoogleDriveService.getBrowseThumbnail(Number(userId), fileId, version);
            if (result.error) return sendResult(res, result);

            res.set("Cache-Control", `private, max-age=${verification.maxAge}`);
            res.removeHeader("Pragma");
            res.removeHeader("Expires");
            return res.sendFile(result.data.filePath, { cacheControl: false }, (error) => {
                if (error && !res.headersSent) res.status(404).json({ success: false, message: "File not found" });
            });
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async expandSelection(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.expandSelection(req.body, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async getPreviews(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.getPreviews(req.body, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async linkFiles(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.linkFiles(req.body, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async disconnect(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.disconnect(req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = GoogleDriveController;
