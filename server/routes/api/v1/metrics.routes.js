const express = require("express");
const MetricsController = require("../../../controllers/Metrics.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// GET /api/v1/metrics - Obtener métricas del dashboard
router.get("/", authenticate, MetricsController.getDashboard);

module.exports = router;
