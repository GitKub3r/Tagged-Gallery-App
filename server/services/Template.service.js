const TemplateModel = require("../models/Template.model");

const validateTemplate = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Template data is required" };
    }

    const fields = [
        ["name", 100],
        ["displayname", 255],
        ["author", 100],
    ];
    for (const [field, maxLength] of fields) {
        if (typeof body[field] !== "string" || body[field].trim().length > maxLength) {
            return { error: `${field} must be a string of at most ${maxLength} characters` };
        }
    }

    const name = body.name.trim();
    const displayname = body.displayname.trim();
    const author = body.author.trim();
    if (!name) return { error: "Template name is required" };
    if (body.mark_favourite !== undefined && typeof body.mark_favourite !== "boolean") {
        return { error: "mark_favourite must be a boolean" };
    }
    if (!Array.isArray(body.tags) || body.tags.length > 50) {
        return { error: "tags must be an array of at most 50 names" };
    }

    const tags = [];
    const seen = new Set();
    for (const value of body.tags) {
        if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
            return { error: "Each tag must be between 1 and 100 characters" };
        }
        const tag = value.trim();
        const key = tag.toLocaleLowerCase();
        if (!seen.has(key)) {
            tags.push(tag);
            seen.add(key);
        }
    }

    if (!displayname && !author && tags.length === 0 && !body.mark_favourite) {
        return { error: "Add a media name, author, tag or favourite action to the template" };
    }

    return { data: { name, displayname, author, tags, mark_favourite: body.mark_favourite } };
};

class TemplateService {
    static async getAll(userId) {
        return TemplateModel.findAllByUserId(userId);
    }

    static async create(body, userId) {
        const { data, error } = validateTemplate(body);
        if (error) return { error, status: 400 };
        return { data: await TemplateModel.create(userId, data) };
    }

    static async update(id, body, userId) {
        const { data, error } = validateTemplate(body);
        if (error) return { error, status: 400 };
        const updated = await TemplateModel.update(id, userId, data);
        return updated ? { data: updated } : { error: "Template not found", status: 404 };
    }

    static async delete(id, userId) {
        const deleted = await TemplateModel.delete(id, userId);
        return deleted ? { data: null } : { error: "Template not found", status: 404 };
    }
}

module.exports = TemplateService;
