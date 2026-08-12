const express = require("express");
const router = express.Router();
const UserController = require("../../../controllers/User.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");
const { avatarUpload } = require("../../../middlewares/upload.middleware");

// Rutas públicas (sin autenticación)
// POST /api/v1/users/login - Login de usuario
router.post("/login", UserController.login);

// POST /api/v1/users - Crear un nuevo usuario (registro)
router.post("/", UserController.create);

// Rutas protegidas (requieren autenticación)
// GET /api/v1/users - Obtener todos los usuarios
router.get("/", authenticate, UserController.getAll);

router.get("/me", authenticate, UserController.getMe);
router.put("/me", authenticate, UserController.updateMe);
router.put("/me/preferences/media-search", authenticate, UserController.updateMediaSearchPreference);
router.put("/me/password", authenticate, UserController.changeOwnPassword);
router.put("/me/avatar", authenticate, avatarUpload.single("avatar"), UserController.updateAvatar);
router.delete("/me/avatar", authenticate, UserController.resetAvatar);

// GET /api/v1/users/:id - Obtener usuario por ID
router.get("/:id", authenticate, UserController.getById);

// PUT /api/v1/users/:id - Actualizar usuario
router.put("/:id", authenticate, UserController.update);

// DELETE /api/v1/users/:id - Eliminar usuario
router.delete("/:id", authenticate, UserController.delete);

module.exports = router;
