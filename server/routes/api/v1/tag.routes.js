const express = require("express");
const TagController = require("../../../controllers/Tag.controller");
const { authenticateLibrary } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// GET /api/v1/tags - Obtener todas las etiquetas
router.get("/", authenticateLibrary, TagController.getAll);

// GET /api/v1/tags/names - Obtener todos los nombres de tags únicos (A-Z)
router.get("/names", authenticateLibrary, TagController.getDistinctTagNames);

// GET /api/v1/tags/:id - Obtener etiqueta por ID
router.get("/:id", authenticateLibrary, TagController.getById);

// POST /api/v1/tags - Crear etiqueta
router.post("/", authenticateLibrary, TagController.create);

// PUT /api/v1/tags/:id - Actualizar etiqueta
router.put("/:id", authenticateLibrary, TagController.update);

// DELETE /api/v1/tags/:id - Eliminar etiqueta
router.delete("/:id", authenticateLibrary, TagController.delete);

module.exports = router;
