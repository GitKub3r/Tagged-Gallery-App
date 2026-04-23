const express = require("express");
const router = express.Router();

// Importar rutas de versiones
const v1Routes = require("./api/v1");

// Montar rutas de la API v1
router.use("/api/v1", v1Routes);

// Ruta base para información general
router.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "Tagged API",
        availableVersions: {
            v1: "/api/v1",
        },
    });
});

module.exports = router;
