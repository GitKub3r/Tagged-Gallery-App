const express = require("express");
const AiAssistantController = require("../../../controllers/AiAssistant.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);
// GET /api/v1/ai/status - Estado de los modelos, del análisis de la biblioteca y del trabajo en curso
router.get("/status", AiAssistantController.getStatus);
// POST /api/v1/ai/setup - Descargar los modelos (si faltan) y analizar la biblioteca en segundo plano
router.post("/setup", AiAssistantController.setup);
// DELETE /api/v1/ai/models - Borrar los modelos descargados del servidor
router.delete("/models", AiAssistantController.removeModels);
router.put("/settings", AiAssistantController.updateSettings);
// POST /api/v1/ai/suggestions - Tags sugeridas para unas medias, sin aplicarlas
router.post("/suggestions", AiAssistantController.suggest);
// POST /api/v1/ai/tag - Añadir las tags sugeridas a unas medias
router.post("/tag", AiAssistantController.tagMedia);
// POST /api/v1/ai/library-run - Etiquetar toda la biblioteca en segundo plano; DELETE lo detiene
router.post("/library-run", AiAssistantController.startLibraryRun);
router.delete("/library-run", AiAssistantController.cancelJob);

module.exports = router;
