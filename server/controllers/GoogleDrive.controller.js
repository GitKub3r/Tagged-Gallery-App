const GoogleDriveService = require("../services/GoogleDrive.service");

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

    static async getPickerToken(req, res) {
        try {
            return sendResult(res, await GoogleDriveService.getPickerToken(req.user));
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
