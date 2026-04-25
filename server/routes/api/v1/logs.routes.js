const express = require("express");
const LogsController = require("../../../controllers/Logs.controller");
const { authenticate, isAdmin } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// POST /api/v1/logs/unauthorized-access - Record unauthorized access attempt (requires auth but not admin)
router.post("/unauthorized-access", authenticate, LogsController.recordUnauthorizedAccess);

// All other routes require admin
router.use(authenticate, isAdmin);

// GET /api/v1/logs/today
router.get("/today", LogsController.getTodayLogs);

// GET /api/v1/logs/dates
router.get("/dates", LogsController.getLogDates);

// POST /api/v1/logs/backup
router.post("/backup", LogsController.downloadDatabaseBackup);
router.post("/backup/cancel", LogsController.cancelDatabaseBackup);

// GET /api/v1/logs
router.get("/", LogsController.getLogs);

// GET /api/v1/logs/actions
router.get("/actions", LogsController.getActions);

// POST /api/v1/logs/actions
router.post("/actions", LogsController.createAction);

// PUT /api/v1/logs/actions/:id
router.put("/actions/:id", LogsController.updateAction);

// DELETE /api/v1/logs/actions/:id
router.delete("/actions/:id", LogsController.deleteAction);

module.exports = router;
