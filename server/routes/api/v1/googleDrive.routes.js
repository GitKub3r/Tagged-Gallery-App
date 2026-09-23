const express = require("express");
const GoogleDriveController = require("../../../controllers/GoogleDrive.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);

// GET /api/v1/google-drive/status - Estado de la conexión y configuración pública para el cliente
router.get("/status", GoogleDriveController.getStatus);

// POST /api/v1/google-drive/connect - Canjear el código de autorización de Google
router.post("/connect", GoogleDriveController.connect);

// GET /api/v1/google-drive/picker-token - Token de acceso corto (solo drive.file) para el Google Picker
router.get("/picker-token", GoogleDriveController.getPickerToken);

// POST /api/v1/google-drive/previews - Miniaturas de los archivos elegidos, para revisarlos antes de añadirlos
router.post("/previews", GoogleDriveController.getPreviews);

// POST /api/v1/google-drive/link - Vincular archivos de Drive elegidos como medias (sin copiar el original)
router.post("/link", GoogleDriveController.linkFiles);

// POST /api/v1/google-drive/disconnect - Revocar el acceso y desconectar la cuenta
router.post("/disconnect", GoogleDriveController.disconnect);

module.exports = router;
