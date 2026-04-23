const express = require("express");
const TagController = require("../../../controllers/Tag.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// GET /api/v1/tags - Obtener todas las etiquetas
router.get("/", authenticate, TagController.getAll);

// GET /api/v1/tags/names - Obtener todos los nombres de tags únicos (A-Z)
router.get("/names", authenticate, TagController.getDistinctTagNames);

// GET /api/v1/tags/:id - Obtener etiqueta por ID
router.get("/:id", authenticate, TagController.getById);

// POST /api/v1/tags - Crear etiqueta
router.post("/", authenticate, TagController.create);

// PUT /api/v1/tags/:id - Actualizar etiqueta
router.put("/:id", authenticate, TagController.update);

// DELETE /api/v1/tags/:id - Eliminar etiqueta
router.delete("/:id", authenticate, TagController.delete);

module.exports = router;
