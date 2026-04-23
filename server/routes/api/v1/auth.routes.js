const express = require("express");
const router = express.Router();
const AuthController = require("../../../controllers/Auth.controller");
const { authenticate } = require("../../../middlewares/auth.middleware");

// POST /api/v1/auth/refresh - Refrescar access token
router.post("/refresh", AuthController.refresh);

// POST /api/v1/auth/logout - Logout (eliminar refresh token específico)
router.post("/logout", AuthController.logout);

// POST /api/v1/auth/logout-all - Logout de todos los dispositivos (requiere autenticación)
router.post("/logout-all", authenticate, AuthController.logoutAll);

module.exports = router;
