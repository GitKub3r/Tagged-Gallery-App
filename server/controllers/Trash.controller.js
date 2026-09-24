const TrashService = require("../services/Trash.service");

const handleError = (error, res) => {
    console.error("Trash request failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

const sendResult = (res, result) =>
    result.error
        ? res.status(result.status).json({ success: false, message: result.error })
        : res.json({ success: true, data: result.data });

class TrashController {
    static async getAll(req, res) {
        try {
            return sendResult(res, await TrashService.getAll(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async restore(req, res) {
        try {
            return sendResult(res, await TrashService.restore(req.body, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async deleteForever(req, res) {
        try {
            return sendResult(res, await TrashService.deleteForever(req.body, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = TrashController;
