const { verifyToken } = require("../utils/jwt");

/**
 * Middleware para verificar que el usuario está autenticado
 */
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authorization token required",
            });
        }

        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        const statusCode = error.message === "Token expired" ? 401 : 401;
        res.status(statusCode).json({
            success: false,
            message: error.message || "Invalid or expired token",
        });
    }
};

module.exports = authMiddleware;
