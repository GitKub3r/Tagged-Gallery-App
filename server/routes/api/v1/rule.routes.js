const express = require("express");
const RuleController = require("../../../controllers/Rule.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.get("/", RuleController.getAll);
router.post("/", RuleController.create);
router.get("/:id", RuleController.getById);
router.put("/:id", RuleController.update);
router.delete("/:id", RuleController.delete);
// POST /api/v1/rules/:id/run - Aplicar la regla a toda la biblioteca
router.post("/:id/run", RuleController.run);

module.exports = router;
