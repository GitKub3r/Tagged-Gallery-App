const express = require("express");
const MetadataController = require("../../../controllers/Metadata.controller");
const { authenticateLibrary } = require("../../../middlewares/auth.middleware");

const router = express.Router();

router.use(authenticateLibrary);
// GET /api/v1/metadata/:kind/media-count?value= - Medias que usan una tag, un nombre de media o un autor
router.get("/:kind/media-count", MetadataController.getMediaCount);
// DELETE /api/v1/metadata/:kind/media (body: { value }) - Quitar ese valor de todas las medias
router.delete("/:kind/media", MetadataController.removeFromAllMedia);

module.exports = router;
