const MetadataService = require("../services/Metadata.service");

const handleError = (error, res) => {
    console.error("Metadata request failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

const sendResult = (res, result) =>
    result.error
        ? res.status(result.status).json({ success: false, message: result.error })
        : res.json({ success: true, data: result.data });

class MetadataController {
    static async getMediaCount(req, res) {
        try {
            return sendResult(res, await MetadataService.getMediaCount(req.params.kind, req.query.value, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async removeFromAllMedia(req, res) {
        try {
            return sendResult(res, await MetadataService.removeFromAllMedia(req.params.kind, req.body?.value, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = MetadataController;
