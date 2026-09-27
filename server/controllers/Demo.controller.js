const DemoService = require("../services/Demo.service");

const handleError = (error, res) => {
    console.error("Demo request failed:", error);
    return res.status(500).json({ success: false, message: "Could not prepare the demo library" });
};

const sendResult = (res, result) =>
    result.error ? res.status(result.status).json({ success: false, message: result.error }) : res.json({ success: true, data: result.data });

class DemoController {
    static async getStatus(req, res) {
        try {
            return sendResult(res, await DemoService.getStatus(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async setEnabled(req, res) {
        try {
            return sendResult(res, await DemoService.setEnabled(req.user, req.body || {}, req));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async reset(req, res) {
        try {
            return sendResult(res, await DemoService.reset(req.user, req.body || {}, req));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = DemoController;
