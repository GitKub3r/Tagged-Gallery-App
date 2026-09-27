const express = require("express");
const TemplateController = require("../../../controllers/Template.controller");
const { authenticateLibrary } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateLibrary);
router.get("/", TemplateController.getAll);
router.post("/", TemplateController.create);
router.put("/:id", TemplateController.update);
router.delete("/:id", TemplateController.delete);

module.exports = router;
