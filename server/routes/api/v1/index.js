const express = require("express");
const router = express.Router();

// Importar rutas
const userRoutes = require("./user.routes");
const authRoutes = require("./auth.routes");
const mediaRoutes = require("./media.routes");
const tagRoutes = require("./tag.routes");
const albumRoutes = require("./album.routes");
const templateRoutes = require("./template.routes");
const metricsRoutes = require("./metrics.routes");
const logsRoutes = require("./logs.routes");
const filesRoutes = require("./files.routes");
const googleDriveRoutes = require("./googleDrive.routes");
const trashRoutes = require("./trash.routes");
const ruleRoutes = require("./rule.routes");
const metadataRoutes = require("./metadata.routes");
const demoRoutes = require("./demo.routes");
const aiRoutes = require("./ai.routes");

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
            templates: "/api/v1/templates",
            rules: "/api/v1/rules",
            runRule: "/api/v1/rules/:id/run",
            aiStatus: "/api/v1/ai/status",
            aiTagMedia: "/api/v1/ai/tag",
            metadataMediaCount: "/api/v1/metadata/:kind/media-count",
            removeMetadataFromMedia: "/api/v1/metadata/:kind/media",
            demo: "/api/v1/demo",
            resetDemo: "/api/v1/demo/reset",
            googleDriveStatus: "/api/v1/google-drive/status",
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
router.use("/templates", templateRoutes);
router.use("/metrics", metricsRoutes);
router.use("/logs", logsRoutes);
router.use("/files", filesRoutes);
router.use("/google-drive", googleDriveRoutes);
router.use("/trash", trashRoutes);
router.use("/rules", ruleRoutes);
router.use("/metadata", metadataRoutes);
router.use("/demo", demoRoutes);
router.use("/ai", aiRoutes);

module.exports = router;
