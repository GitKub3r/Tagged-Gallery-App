const TagModel = require("../models/Tag.model");

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const VALID_TYPES = ["default", "copyright"];
const DEFAULT_TAG_COLOR = "#643aff";

class TagService {
    static validateFields({ tagname, tagcolor_hex, type } = {}, requireAll = true) {
        if (requireAll && (!tagname || typeof tagname !== "string")) {
            return { success: false, message: "tagname is required" };
        }

        if (tagname !== undefined) {
            const trimmed = tagname.trim();
            if (trimmed.length < 1 || trimmed.length > 100) {
                return { success: false, message: "tagname must be between 1 and 100 characters" };
            }
        }

        if (tagcolor_hex !== undefined && tagcolor_hex !== null && tagcolor_hex !== "") {
            if (!HEX_COLOR_REGEX.test(tagcolor_hex)) {
                return { success: false, message: "tagcolor_hex must be a valid hex color (e.g. #FF5733)" };
            }
        }

        if (type !== undefined && !VALID_TYPES.includes(type)) {
            return { success: false, message: `type must be one of: ${VALID_TYPES.join(", ")}` };
        }

        return { success: true };
    }

    static async getAll(requestUser) {
        try {
            const tags =
                requestUser.type === "admin"
                    ? await TagModel.findAll()
                    : await TagModel.findAllByUserId(requestUser.id);
            return { success: true, data: tags };
        } catch (error) {
            console.error("Error in TagService.getAll:", error);
            throw new Error("Error fetching tags");
        }
    }

    static async getDistinctTagNames(requestUser) {
        try {
            const rows =
                requestUser.type === "admin"
                    ? await TagModel.findDistinctTagNames()
                    : await TagModel.findDistinctTagNamesByUserId(requestUser.id);

            return { success: true, data: rows.map((row) => row.tagname) };
        } catch (error) {
            console.error("Error in TagService.getDistinctTagNames:", error);
            throw new Error("Error fetching distinct tag names");
        }
    }

    static async getById(id, requestUser) {
        try {
            const tag =
                requestUser.type === "admin"
                    ? await TagModel.findById(id)
                    : await TagModel.findByIdForUser(id, requestUser.id);
            if (!tag) {
                return { success: false, message: "Tag not found" };
            }
            return { success: true, data: tag };
        } catch (error) {
            console.error("Error in TagService.getById:", error);
            throw new Error("Error fetching tag");
        }
    }

    static async create(tagData, requestUser) {
        try {
            const validation = this.validateFields(tagData, true);
            if (!validation.success) return validation;

            const { tagname, tagcolor_hex, type } = tagData;
            const trimmedName = tagname.trim();

            const exists = await TagModel.tagnameExists(trimmedName, requestUser.id);
            if (exists) {
                return { success: false, message: "A tag with that name already exists" };
            }

            const created = await TagModel.create({
                user_id: requestUser.id,
                tagname: trimmedName,
                tagcolor_hex: tagcolor_hex || DEFAULT_TAG_COLOR,
                type: type || "default",
            });

            return { success: true, data: created, message: "Tag created successfully" };
        } catch (error) {
            console.error("Error in TagService.create:", error);
            throw new Error("Error creating tag");
        }
    }

    static async update(id, tagData, requestUser) {
        try {
            const existing =
                requestUser.type === "admin"
                    ? await TagModel.findById(id)
                    : await TagModel.findByIdForUser(id, requestUser.id);
            if (!existing) {
                return { success: false, message: "Tag not found" };
            }

            const validation = this.validateFields(tagData, false);
            if (!validation.success) return validation;

            if (tagData.tagname !== undefined) {
                const trimmedName = tagData.tagname.trim();
                tagData.tagname = trimmedName;

                const exists = await TagModel.tagnameExists(trimmedName, existing.user_id, id);
                if (exists) {
                    return { success: false, message: "A tag with that name already exists" };
                }
            }

            if (tagData.tagcolor_hex === "") {
                tagData.tagcolor_hex = null;
            }

            const updated = await TagModel.update(id, tagData);
            if (!updated) {
                return { success: false, message: "No changes were made" };
            }

            const updatedTag = await TagModel.findById(id);
            return { success: true, data: updatedTag, message: "Tag updated successfully" };
        } catch (error) {
            console.error("Error in TagService.update:", error);
            throw new Error("Error updating tag");
        }
    }

    static async delete(id, requestUser) {
        try {
            const existing =
                requestUser.type === "admin"
                    ? await TagModel.findById(id)
                    : await TagModel.findByIdForUser(id, requestUser.id);
            if (!existing) {
                return { success: false, message: "Tag not found" };
            }

            await TagModel.delete(id);
            return { success: true, message: "Tag deleted successfully" };
        } catch (error) {
            console.error("Error in TagService.delete:", error);
            throw new Error("Error deleting tag");
        }
    }
}

module.exports = TagService;
