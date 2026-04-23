const ActionModel = require("../models/Action.model");
const HistoryModel = require("../models/History.model");

const LOGS_TIMEZONE = "Europe/Madrid";

const getSpainDateInputValue = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: LOGS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
        return null;
    }

    return `${year}-${month}-${day}`;
};

class LogsService {
    static async getLogs(query = {}) {
        const result = await HistoryModel.findAll({
            page: query.page,
            pageSize: query.pageSize,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            search: query.search,
            actionCode: query.actionCode,
            statusCode: query.statusCode,
            statusGroup: query.statusGroup,
        });

        return {
            success: true,
            data: result.data,
            pagination: result.pagination,
        };
    }

    static async getTodayLogs(query = {}) {
        const today = getSpainDateInputValue();

        if (!today) {
            return this.getLogs(query);
        }

        return this.getLogs({
            ...query,
            dateFrom: today,
            dateTo: today,
        });
    }

    static async getLogDates(query = {}) {
        const rows = await HistoryModel.findAvailableDates({
            search: query.search,
            actionCode: query.actionCode,
            statusCode: query.statusCode,
            statusGroup: query.statusGroup,
            limit: query.limit,
        });

        return {
            success: true,
            data: rows,
        };
    }

    static async getActions() {
        const rows = await ActionModel.findAll({ includeInactive: true });
        return {
            success: true,
            data: rows,
        };
    }

    static normalizeActionCode(input) {
        return String(input || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");
    }

    static async createAction(payload) {
        const actionname = String(payload?.actionname || "").trim();
        const rawCode = payload?.actioncode;
        const actioncode = this.normalizeActionCode(rawCode || actionname);
        const description = payload?.description ? String(payload.description).trim() : null;

        if (!actionname) {
            return { success: false, message: "actionname is required" };
        }

        if (!actioncode) {
            return { success: false, message: "actioncode is required" };
        }

        try {
            const created = await ActionModel.create({
                actionname,
                actioncode,
                description,
                is_active: payload?.is_active !== false,
            });

            return {
                success: true,
                data: created,
            };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return {
                    success: false,
                    message: "actioncode already exists",
                };
            }
            throw error;
        }
    }

    static async updateAction(id, payload) {
        const current = await ActionModel.findById(id);
        if (!current) {
            return { success: false, message: "Action not found" };
        }

        const updatePayload = {};

        if (payload.actionname !== undefined) {
            const actionname = String(payload.actionname || "").trim();
            if (!actionname) {
                return { success: false, message: "actionname cannot be empty" };
            }
            updatePayload.actionname = actionname;
        }

        if (payload.actioncode !== undefined) {
            const actioncode = this.normalizeActionCode(payload.actioncode);
            if (!actioncode) {
                return { success: false, message: "actioncode cannot be empty" };
            }
            updatePayload.actioncode = actioncode;
        }

        if (payload.description !== undefined) {
            updatePayload.description = payload.description ? String(payload.description).trim() : null;
        }

        if (payload.is_active !== undefined) {
            updatePayload.is_active = Boolean(payload.is_active);
        }

        try {
            const updated = await ActionModel.update(id, updatePayload);

            return {
                success: true,
                data: updated,
            };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return {
                    success: false,
                    message: "actioncode already exists",
                };
            }
            throw error;
        }
    }

    static async deleteAction(id) {
        const current = await ActionModel.findById(id);
        if (!current) {
            return { success: false, message: "Action not found" };
        }

        const usageCount = await HistoryModel.countByActionId(id);
        if (usageCount > 0) {
            return {
                success: false,
                message: "Cannot delete action because it is already used in history logs",
            };
        }

        await ActionModel.delete(id);

        return {
            success: true,
            message: "Action deleted",
        };
    }
}

module.exports = LogsService;
