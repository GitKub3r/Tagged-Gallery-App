const LogsService = require("../services/Logs.service");
const AuditService = require("../services/Audit.service");
const HistoryModel = require("../models/History.model");

class LogsController {
    static async getLogs(req, res) {
        try {
            const result = await LogsService.getLogs(req.query);

            return res.json(result);
        } catch (error) {
            console.error("Error in LogsController.getLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async getTodayLogs(req, res) {
        try {
            const result = await LogsService.getTodayLogs(req.query);

            return res.json(result);
        } catch (error) {
            console.error("Error in LogsController.getTodayLogs:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async getLogDates(req, res) {
        try {
            const result = await LogsService.getLogDates(req.query);

            return res.json(result);
        } catch (error) {
            console.error("Error in LogsController.getLogDates:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async getActions(req, res) {
        try {
            const result = await LogsService.getActions();
            return res.json(result);
        } catch (error) {
            console.error("Error in LogsController.getActions:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async createAction(req, res) {
        try {
            const result = await LogsService.createAction(req.body);
            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(201).json(result);
        } catch (error) {
            console.error("Error in LogsController.createAction:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async updateAction(req, res) {
        try {
            const result = await LogsService.updateAction(req.params.id, req.body);
            if (!result.success) {
                const statusCode = result.message === "Action not found" ? 404 : 400;
                return res.status(statusCode).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in LogsController.updateAction:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async deleteAction(req, res) {
        try {
            const result = await LogsService.deleteAction(req.params.id);
            if (!result.success) {
                const statusCode = result.message === "Action not found" ? 404 : 400;
                return res.status(statusCode).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in LogsController.deleteAction:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    static async recordUnauthorizedAccess(req, res) {
        try {
            const { attemptedRoute, userType } = req.body;
            const user = req.user;

            if (!user || !attemptedRoute) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields",
                });
            }

            // Ensure action exists
            const actionCode = "UNAUTHORIZED_ROUTE_ACCESS";
            await AuditService.ensureAction(actionCode);

            // Record unauthorized access
            const normalizedUserType = String(userType || "User");
            const displayUserType =
                normalizedUserType.charAt(0).toUpperCase() + normalizedUserType.slice(1).toLowerCase();

            const historyEntry = {
                action_code: actionCode,
                userid: user.id,
                status_code: 401,
                message: `${displayUserType} user attempted unauthorized access to ${attemptedRoute}`,
                request_method: "GET",
                request_path: attemptedRoute,
                ip_address: AuditService.getClientIp(req),
                user_agent: req.headers["user-agent"],
                metadata: {
                    userType,
                    attemptedRoute,
                    timestamp: new Date().toISOString(),
                },
            };

            await HistoryModel.create(historyEntry);

            return res.status(200).json({
                success: true,
                message: "Unauthorized access recorded",
            });
        } catch (error) {
            console.error("Error in LogsController.recordUnauthorizedAccess:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
}

module.exports = LogsController;
