const AiAssistantService = require("../services/AiAssistant.service");

const handleError = (error, res) => {
    console.error("AI assistant request failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

const sendResult = (res, result, successStatus = 200) =>
    result.error
        ? res.status(result.status).json({ success: false, message: result.error })
        : res.status(successStatus).json({ success: true, data: result.data });

class AiAssistantController {
    static async getStatus(req, res) {
        try {
            return sendResult(res, await AiAssistantService.getStatus(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async setup(req, res) {
        try {
            return sendResult(res, await AiAssistantService.setup(req.user, req), 202);
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async removeModels(req, res) {
        try {
            return sendResult(res, await AiAssistantService.removeModels(req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async updateSettings(req, res) {
        try {
            return sendResult(res, await AiAssistantService.updateSettings(req.body, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async suggest(req, res) {
        try {
            return sendResult(res, await AiAssistantService.suggest(req.body, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async tagMedia(req, res) {
        try {
            return sendResult(res, await AiAssistantService.tagMedia(req.body, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async startLibraryRun(req, res) {
        try {
            return sendResult(res, await AiAssistantService.startLibraryRun(req.user, req), 202);
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async cancelJob(req, res) {
        try {
            return sendResult(res, await AiAssistantService.cancelJob(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = AiAssistantController;
