const express = require("express");
const router = express.Router();

// Importar rutas
const userRoutes = require("./user.routes");
const authRoutes = require("./auth.routes");
const mediaRoutes = require("./media.routes");
const tagRoutes = require("./tag.routes");
const albumRoutes = require("./album.routes");
const metricsRoutes = require("./metrics.routes");
const logsRoutes = require("./logs.routes");

// Endpoint de bienvenida de la API v1
router.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "Tagged API v1",
        version: "1.0.0",
        endpoints: {
            health: "/api/v1/health",
            users: "/api/v1/users",
            login: "/api/v1/users/login",
            refresh: "/api/v1/auth/refresh",
            logout: "/api/v1/auth/logout",
            mediaDisplayNames: "/api/v1/media/displaynames",
            mediaAuthors: "/api/v1/media/authors",
            metrics: "/api/v1/metrics",
            uploadSingleMedia: "/api/v1/media/upload",
            uploadMultipleMedia: "/api/v1/media/upload/multiple",
            toggleMediaFavourite: "/api/v1/media/:id/toggle-favourite",
            deleteMultipleMedia: "/api/v1/media",
            tags: "/api/v1/tags",
            tagNames: "/api/v1/tags/names",
            albums: "/api/v1/albums",
            albumCover: "/api/v1/albums/:id/cover",
            albumMedia: "/api/v1/albums/:id/media",
            logs: "/api/v1/logs",
            logsToday: "/api/v1/logs/today",
            logDates: "/api/v1/logs/dates",
            actions: "/api/v1/logs/actions",
        },
    });
});

// Endpoint de health check
router.get("/health", (req, res) => {
    res.json({
        status: "success",
        message: "API working successfully",
        timestamp: new Date().toISOString(),
    });
});

// Montar rutas de recursos
router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/media", mediaRoutes);
router.use("/tags", tagRoutes);
router.use("/albums", albumRoutes);
router.use("/metrics", metricsRoutes);
router.use("/logs", logsRoutes);

module.exports = router;
