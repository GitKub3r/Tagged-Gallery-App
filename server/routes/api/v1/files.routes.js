const express = require("express");
const { verifyUploadRequest } = require("../../../utils/uploadUrls");

const router = express.Router();

// GET /api/v1/files/:folder/:filename?exp=&sig= - Servir un archivo subido mediante URL firmada.
// No usa authenticate: <img> y <video> no pueden enviar la cabecera Authorization.
// La firma solo se emite en respuestas autenticadas que ya han pasado el control de propiedad.
router.get("/:folder/:filename", (req, res) => {
    const relativePath = `${req.params.folder}/${req.params.filename}`;
    const verification = verifyUploadRequest(relativePath, req.query.exp, req.query.sig);

    if (!verification.valid) {
        return res.status(403).json({ success: false, message: "Invalid or expired file link" });
    }

    res.set("Cache-Control", `private, max-age=${verification.maxAge}`);
    res.removeHeader("Pragma");
    res.removeHeader("Expires");

    return res.sendFile(verification.filePath, { cacheControl: false, dotfiles: "deny" }, (error) => {
        if (!error || res.headersSent) return;
        const status = error.code === "ENOENT" || error.status === 404 ? 404 : 500;
        res.status(status).json({ success: false, message: status === 404 ? "File not found" : "Could not read file" });
    });
});

module.exports = router;
