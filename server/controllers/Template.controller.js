const TemplateService = require("../services/Template.service");

const handleError = (error, res) => {
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "A template with that name already exists" });
    }
    console.error("Template request failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

const sendResult = (res, result, successStatus = 200) =>
    result.error
        ? res.status(result.status).json({ success: false, message: result.error })
        : res.status(successStatus).json({ success: true, data: result.data });

class TemplateController {
    static async getAll(req, res) {
        try {
            return res.json({ success: true, data: await TemplateService.getAll(req.user.id) });
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async create(req, res) {
        try {
            return sendResult(res, await TemplateService.create(req.body, req.user.id), 201);
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async update(req, res) {
        try {
            return sendResult(res, await TemplateService.update(req.params.id, req.body, req.user.id));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async delete(req, res) {
        try {
            return sendResult(res, await TemplateService.delete(req.params.id, req.user.id));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = TemplateController;
