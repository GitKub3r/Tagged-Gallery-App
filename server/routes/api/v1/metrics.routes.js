const express = require("express");
const MetricsController = require("../../../controllers/Metrics.controller");
const { authenticateLibrary } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// GET /api/v1/metrics - Obtener métricas del dashboard
router.get("/", authenticateLibrary, MetricsController.getDashboard);

module.exports = router;
