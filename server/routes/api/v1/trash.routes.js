const express = require("express");
const TrashController = require("../../../controllers/Trash.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);

// GET /api/v1/trash - Medias en la papelera, con los días que les quedan
router.get("/", TrashController.getAll);

// POST /api/v1/trash/restore - Restaurar medias de la papelera { ids }
router.post("/restore", TrashController.restore);

// DELETE /api/v1/trash - Borrar definitivamente { ids } o vaciar la papelera { all: true }
router.delete("/", TrashController.deleteForever);

module.exports = router;
