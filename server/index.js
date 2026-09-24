// Cargar variables de entorno
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/database");
const routes = require("./routes");
const { ensureUploadDirs } = require("./middlewares/upload.middleware");
const { signUploadUrlsInResponses } = require("./utils/uploadUrls");
const AuditService = require("./services/Audit.service");
const UserModel = require("./models/User.model");
const AlbumModel = require("./models/Album.model");
const TemplateModel = require("./models/Template.model");
const MediaModel = require("./models/Media.model");
const GoogleDriveConnectionModel = require("./models/GoogleDriveConnection.model");
const GoogleDriveService = require("./services/GoogleDrive.service");
const TrashService = require("./services/Trash.service");

const app = express();

// Configurar CORS
const configuredCorsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const isAllowedDevOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    try {
        const { hostname, port } = new URL(origin);
        const isFrontendPort = port === "5173";
        const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
        const isPrivateLan =
            /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
            /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
            /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

        return isFrontendPort && (isLocalhost || isPrivateLan);
    } catch {
        return false;
    }
};

app.use(
    cors({
        origin(origin, callback) {
            if (configuredCorsOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`CORS origin not allowed: ${origin}`));
        },
        credentials: true,
    }),
);

app.use(express.json());

app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
});

// Sustituir rutas internas de /uploads por URLs firmadas en las respuestas de la API.
// Los archivos subidos no son públicos: solo se sirven desde /api/v1/files con una firma válida.
app.use("/api", signUploadUrlsInResponses);

// Crear estructura de carpetas para uploads si no existe
ensureUploadDirs();

// Montar todas las rutas
app.use(routes);

// Captura de rutas no existentes para auditoria
app.use((req, res) => {
    AuditService.logEvent({
        actionCode: "ROUTE_NOT_FOUND",
        req,
        statusCode: 404,
        message: "Requested endpoint does not exist",
    });

    return res.status(404).json({
        success: false,
        message: "Endpoint not found",
    });
});

// Función para iniciar el servidor
const startServer = async () => {
    try {
        // Conectar a la base de datos primero
        await connectDB();
        await UserModel.ensureAvatarColumn();
        await UserModel.ensureMediaNameMatchModeColumn();
        await UserModel.ensureSessionVersionColumn();
        await UserModel.ensureDevRole();
        await AlbumModel.ensureCoverAdjustmentColumns();
        await TemplateModel.ensureTable();
        await MediaModel.ensureColumns();
        await GoogleDriveConnectionModel.ensureTable();
        await GoogleDriveService.ensureDriveTags();
        GoogleDriveService.pruneBrowseThumbnails();
        TrashService.startPurgeSchedule();

        // Si la conexión fue exitosa, iniciar el servidor
        const port = process.env.PORT || 4000;
        app.listen(port, () => {
            console.log(`\n🚀 Server running on http://localhost:${port}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
        });
    } catch (error) {
        console.error("\n💥 Could not start server due to database connection error");
        process.exit(1);
    }
};

// Iniciar el servidor
startServer();
