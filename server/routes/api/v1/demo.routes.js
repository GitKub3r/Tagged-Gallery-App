const express = require("express");
const DemoController = require("../../../controllers/Demo.controller");
const { authenticate, isAdmin } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// Modo demo: solo para cuentas admin.
router.use(authenticate, isAdmin);
// GET /api/v1/demo - Estado del modo demo y resumen de la biblioteca demo
router.get("/", DemoController.getStatus);
// PUT /api/v1/demo - Activar o desactivar el modo demo ({ enabled }); la primera vez crea la biblioteca demo
router.put("/", DemoController.setEnabled);
// POST /api/v1/demo/reset - Volver a crear la biblioteca demo desde cero
router.post("/reset", DemoController.reset);

module.exports = router;
