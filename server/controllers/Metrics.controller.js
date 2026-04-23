const MetricsService = require("../services/Metrics.service");
const AuditService = require("../services/Audit.service");

class MetricsController {
    static async getDashboard(req, res) {
        try {
            if (req.user?.type === "admin") {
                await AuditService.logEvent({
                    actionCode: "UNAUTHORIZED_ROUTE_ACCESS",
                    req,
                    userId: req.user?.id,
                    statusCode: 403,
                    message: "Dashboard access is restricted for admin accounts",
                });
                return res.status(403).json({
                    success: false,
                    message: "Dashboard access is restricted for admin accounts",
                });
            }

            const result = await MetricsService.getDashboard(req.user, req.query.year);
            return res.json(result);
        } catch (error) {
            console.error("Error in MetricsController.getDashboard:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

module.exports = MetricsController;
