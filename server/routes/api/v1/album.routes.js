const express = require("express");
const AlbumController = require("../../../controllers/Album.controller");
const { authenticateLibrary } = require("../../../middlewares/auth.middleware");

const router = express.Router();

// ─── CRUD ────────────────────────────────────────────────────────────────────

// GET    /api/v1/albums       - List all albums
router.get("/", authenticateLibrary, AlbumController.getAll);
router.get("/names", authenticateLibrary, AlbumController.getNames);

// POST   /api/v1/albums       - Create an album
router.post("/", authenticateLibrary, AlbumController.create);

// GET    /api/v1/albums/:id   - Get album by id
router.get("/:id", authenticateLibrary, AlbumController.getById);

// PUT    /api/v1/albums/:id   - Rename album
router.put("/:id", authenticateLibrary, AlbumController.update);

// DELETE /api/v1/albums/:id   - Delete album
router.delete("/:id", authenticateLibrary, AlbumController.delete);

// ─── COVER ───────────────────────────────────────────────────────────────────

// POST   /api/v1/albums/:id/cover  - Assign / replace album cover from an existing image media
router.post("/:id/cover", authenticateLibrary, AlbumController.uploadCover);
router.put("/:id/cover/adjustment", authenticateLibrary, AlbumController.adjustCover);

// DELETE /api/v1/albums/:id/cover  - Remove album cover
router.delete("/:id/cover", authenticateLibrary, AlbumController.deleteCover);

// ─── MEDIA RELATIONS ─────────────────────────────────────────────────────────

// GET    /api/v1/albums/:id/media              - List all media in album
router.get("/:id/media", authenticateLibrary, AlbumController.getMedia);

// POST   /api/v1/albums/:id/media              - Add a single media item to album
router.post("/:id/media", authenticateLibrary, AlbumController.addMedia);

// POST   /api/v1/albums/:id/media/batch        - Add several media items to album at once
router.post("/:id/media/batch", authenticateLibrary, AlbumController.addManyMedia);

// DELETE /api/v1/albums/:id/media/:mediaId     - Remove a single media item from album
router.delete("/:id/media/:mediaId", authenticateLibrary, AlbumController.removeMedia);

// DELETE /api/v1/albums/:id/media              - Remove several media items from album (body: { media_ids })
router.delete("/:id/media", authenticateLibrary, AlbumController.removeManyMedia);

// PUT    /api/v1/albums/:id/media/order        - Persist custom order for album media (body: { media_ids })
router.put("/:id/media/order", authenticateLibrary, AlbumController.reorderMedia);

module.exports = router;
