const express = require("express");
const multer = require("multer");
const MediaController = require("../../../controllers/Media.controller");
const { upload } = require("../../../middlewares/upload.middleware");
const { authenticate } = require("../../../middlewares/auth.middleware");
const AuditService = require("../../../services/Audit.service");

const router = express.Router();

// GET /api/v1/media - Listar media
router.get("/", authenticate, MediaController.getAll);

// GET /api/v1/media/displaynames - Listar displaynames únicos (A-Z)
router.get("/displaynames", authenticate, MediaController.getDistinctDisplayNames);

// POST /api/v1/media/displaynames - Crear displayname gestionable
router.post("/displaynames", authenticate, MediaController.createDisplayName);

// PUT /api/v1/media/displaynames - Renombrar displayname en medias del usuario
router.put("/displaynames", authenticate, MediaController.updateDisplayName);

// DELETE /api/v1/media/displaynames - Eliminar displayname (reemplaza en medias)
router.delete("/displaynames", authenticate, MediaController.deleteDisplayName);

// GET /api/v1/media/authors - Listar autores únicos (A-Z)
router.get("/authors", authenticate, MediaController.getDistinctAuthors);

// POST /api/v1/media/authors - Crear autor gestionable
router.post("/authors", authenticate, MediaController.createAuthor);

// PUT /api/v1/media/authors - Renombrar autor en medias del usuario
router.put("/authors", authenticate, MediaController.updateAuthor);

// DELETE /api/v1/media/authors - Eliminar autor (limpia medias)
router.delete("/authors", authenticate, MediaController.deleteAuthor);

// GET /api/v1/media/:id - Obtener media por ID
router.get("/:id", authenticate, MediaController.getById);

// POST /api/v1/media/upload - Subir un archivo con sus metadatos
router.post("/upload", authenticate, upload.single("file"), MediaController.uploadSingle);

// POST /api/v1/media/upload/multiple - Subir varios archivos con los mismos metadatos
router.post("/upload/multiple", authenticate, upload.array("files", 50), MediaController.uploadMany);

// PUT /api/v1/media/:id - Actualizar metadatos de un archivo
router.put("/:id", authenticate, MediaController.update);

// PATCH /api/v1/media/:id/toggle-favourite - Alternar favorito
router.patch("/:id/toggle-favourite", authenticate, MediaController.toggleFavourite);

// DELETE /api/v1/media - Eliminar varias medias en una sola petición
router.delete("/", authenticate, MediaController.deleteMany);

// DELETE /api/v1/media/:id - Eliminar archivo, thumbnail y registro en BD
router.delete("/:id", authenticate, MediaController.delete);

router.use(async (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const isManyUpload = req?.path?.includes("/upload/multiple");
        const actionCode = isManyUpload ? "MEDIA_UPLOAD_MANY" : "MEDIA_UPLOAD_SINGLE";

        const responseMessage =
            error.code === "LIMIT_FILE_SIZE" ? "File exceeds the 1GB upload limit" : error.message;

        await AuditService.logEvent({
            actionCode,
            req,
            userId: req.user?.id,
            statusCode: 400,
            message: responseMessage,
            metadata: {
                uploadErrorCode: error.code,
            },
        });

        return res.status(400).json({
            success: false,
            message: responseMessage,
        });
    }

    if (error) {
        const isManyUpload = req?.path?.includes("/upload/multiple");
        const actionCode = isManyUpload ? "MEDIA_UPLOAD_MANY" : "MEDIA_UPLOAD_SINGLE";
        const responseMessage = error.message || "Invalid upload request";

        await AuditService.logEvent({
            actionCode,
            req,
            userId: req.user?.id,
            statusCode: 400,
            message: responseMessage,
        });

        return res.status(400).json({
            success: false,
            message: responseMessage,
        });
    }

    return next();
});

module.exports = router;
