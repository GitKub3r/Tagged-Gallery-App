const express = require("express");
const GoogleDriveController = require("../../../controllers/GoogleDrive.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// GET /api/v1/google-drive/thumbnails/:userId/:fileId?v=&exp=&sig= - Miniatura del explorador mediante URL firmada.
// Va antes de authenticate: <img> no puede enviar la cabecera Authorization.
router.get("/thumbnails/:userId/:fileId", GoogleDriveController.getBrowseThumbnail);

router.use(authenticate);

// GET /api/v1/google-drive/status - Estado de la conexión y configuración pública para el cliente
router.get("/status", GoogleDriveController.getStatus);

// GET /api/v1/google-drive/summary - Totales y últimas medias añadidas desde Drive
router.get("/summary", GoogleDriveController.getSummary);

// POST /api/v1/google-drive/connect - Canjear el código de autorización de Google
router.post("/connect", GoogleDriveController.connect);

// GET /api/v1/google-drive/picker-token - Token de acceso corto (solo drive.file) para el Google Picker
router.get("/picker-token", GoogleDriveController.getPickerToken);

// GET /api/v1/google-drive/browse?view=&folderId=&search=&pageToken= - Explorar el Drive (carpetas, fotos y vídeos)
router.get("/browse", GoogleDriveController.browse);

// POST /api/v1/google-drive/expand - Convertir la selección del Picker (incluidas carpetas) en fotos y vídeos
router.post("/expand", GoogleDriveController.expandSelection);

// POST /api/v1/google-drive/previews - Miniaturas de los archivos elegidos, para revisarlos antes de añadirlos
router.post("/previews", GoogleDriveController.getPreviews);

// POST /api/v1/google-drive/link - Vincular archivos de Drive elegidos como medias (sin copiar el original)
router.post("/link", GoogleDriveController.linkFiles);

// POST /api/v1/google-drive/disconnect - Revocar el acceso y desconectar la cuenta
router.post("/disconnect", GoogleDriveController.disconnect);

module.exports = router;
