// Cargar variables de entorno
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB } = require("./config/database");
const routes = require("./routes");
const { ensureUploadDirs } = require("./middlewares/upload.middleware");
const AuditService = require("./services/Audit.service");

const app = express();

// Configurar CORS
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:5173",
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

// Crear estructura de carpetas para uploads si no existe
ensureUploadDirs();

// Exponer recursos estáticos subidos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
