const { verifyToken } = require("../utils/jwt");
const UserModel = require("../models/User.model");
const AuditService = require("../services/Audit.service");

const shouldAuditUnauthorized = (message) => {
    const normalized = String(message || "")
        .trim()
        .toLowerCase();

    // Token expiration is an expected auth lifecycle event and creates noisy logs.
    if (normalized === "token expired") {
        return false;
    }

    return true;
};

/**
 * Middleware para autenticar peticiones mediante JWT
 * Verifica el token en el header Authorization
 */
const authenticate = async (req, res, next) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            await AuditService.logEvent({
                actionCode: "AUTH_UNAUTHORIZED",
                req,
                statusCode: 401,
                message: "Authorization token required",
            });
            return res.status(401).json({
                success: false,
                message: "Authorization token required",
            });
        }

        // El formato esperado es: "Bearer TOKEN"
        const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

        if (!token) {
            await AuditService.logEvent({
                actionCode: "AUTH_UNAUTHORIZED",
                req,
                statusCode: 401,
                message: "Authorization token required",
            });
            return res.status(401).json({
                success: false,
                message: "Authorization token required",
            });
        }

        // Verificar el token
        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (error) {
            if (shouldAuditUnauthorized(error.message)) {
                await AuditService.logEvent({
                    actionCode: "AUTH_UNAUTHORIZED",
                    req,
                    statusCode: 401,
                    message: error.message || "Invalid or expired token",
                });
            }
            return res.status(401).json({
                success: false,
                message: error.message || "Invalid or expired token",
            });
        }

        // Verificar que el usuario existe
        const user = await UserModel.findById(decoded.id);
        if (!user) {
            await AuditService.logEvent({
                actionCode: "AUTH_UNAUTHORIZED",
                req,
                statusCode: 401,
                message: "User not found",
                userId: decoded?.id || null,
            });
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // Adjuntar la información del usuario a la petición
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            type: user.type,
        };

        next();
    } catch (error) {
        console.error("Error in authenticate middleware:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

/**
 * Middleware para verificar que el usuario es admin
 */
const isAdmin = (req, res, next) => {
    if (!req.user) {
        AuditService.logEvent({
            actionCode: "AUTH_UNAUTHORIZED",
            req,
            statusCode: 401,
            message: "Authentication required",
        });
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }

    if (req.user.type !== "admin") {
        AuditService.logEvent({
            actionCode: "AUTH_FORBIDDEN",
            req,
            statusCode: 403,
            message: "Admin access required",
            userId: req.user.id,
        });
        return res.status(403).json({
            success: false,
            message: "Admin access required",
        });
    }

    next();
};

module.exports = {
    authenticate,
    isAdmin,
};
