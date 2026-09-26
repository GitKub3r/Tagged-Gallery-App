const RuleService = require("../services/Rule.service");

const handleError = (error, res) => {
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success: false, message: "A rule with that name already exists" });
    }
    console.error("Rule request failed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
};

const sendResult = (res, result, successStatus = 200) =>
    result.error
        ? res.status(result.status).json({ success: false, message: result.error })
        : res.status(successStatus).json({ success: true, data: result.data });

class RuleController {
    static async getAll(req, res) {
        try {
            return sendResult(res, await RuleService.getAll(req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async getById(req, res) {
        try {
            return sendResult(res, await RuleService.getById(req.params.id, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async create(req, res) {
        try {
            return sendResult(res, await RuleService.create(req.body, req.user), 201);
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async update(req, res) {
        try {
            return sendResult(res, await RuleService.update(req.params.id, req.body, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async delete(req, res) {
        try {
            return sendResult(res, await RuleService.delete(req.params.id, req.user));
        } catch (error) {
            return handleError(error, res);
        }
    }

    static async run(req, res) {
        try {
            return sendResult(res, await RuleService.run(req.params.id, req.user, req));
        } catch (error) {
            return handleError(error, res);
        }
    }
}

module.exports = RuleController;
