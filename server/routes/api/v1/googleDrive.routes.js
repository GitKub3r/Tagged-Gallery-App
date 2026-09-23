const express = require("express");
const GoogleDriveController = require("../../../controllers/GoogleDrive.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);

// GET /api/v1/google-drive/status - Estado de la conexión y configuración pública para el cliente
router.get("/status", GoogleDriveController.getStatus);

// POST /api/v1/google-drive/connect - Canjear el código de autorización de Google
router.post("/connect", GoogleDriveController.connect);

// POST /api/v1/google-drive/disconnect - Revocar el acceso y desconectar la cuenta
router.post("/disconnect", GoogleDriveController.disconnect);

module.exports = router;
