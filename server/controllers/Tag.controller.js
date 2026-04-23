const TagService = require("../services/Tag.service");

class TagController {
    static async getAll(req, res) {
        try {
            const result = await TagService.getAll(req.user);
            return res.json(result);
        } catch (error) {
            console.error("Error in TagController.getAll:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async getDistinctTagNames(req, res) {
        try {
            const result = await TagService.getDistinctTagNames(req.user);
            return res.json(result);
        } catch (error) {
            console.error("Error in TagController.getDistinctTagNames:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async getById(req, res) {
        try {
            const result = await TagService.getById(req.params.id, req.user);
            if (!result.success) return res.status(404).json(result);
            return res.json(result);
        } catch (error) {
            console.error("Error in TagController.getById:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async create(req, res) {
        try {
            const result = await TagService.create(req.body, req.user);
            if (!result.success) return res.status(400).json(result);
            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in TagController.create:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async update(req, res) {
        try {
            const result = await TagService.update(req.params.id, req.body, req.user);
            if (!result.success) {
                const status = result.message === "Tag not found" ? 404 : 400;
                return res.status(status).json(result);
            }
            return res.json(result);
        } catch (error) {
            console.error("Error in TagController.update:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async delete(req, res) {
        try {
            const result = await TagService.delete(req.params.id, req.user);
            if (!result.success) return res.status(404).json(result);
            return res.json(result);
        } catch (error) {
            console.error("Error in TagController.delete:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

module.exports = TagController;
