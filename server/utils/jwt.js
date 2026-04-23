const jwt = require("jsonwebtoken");

// Access Token configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

// Refresh Token configuration
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key-change-this-in-production";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Generar un access token JWT
 * @param {Object} payload - Datos a incluir en el token
 * @returns {string} Access Token JWT
 */
const generateToken = (payload) => {
    try {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });
    } catch (error) {
        console.error("Error generating token:", error);
        throw new Error("Error generating token");
    }
};

/**
 * Generar un refresh token JWT
 * @param {Object} payload - Datos a incluir en el token
 * @returns {string} Refresh Token JWT
 */
const generateRefreshToken = (payload) => {
    try {
        return jwt.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: JWT_REFRESH_EXPIRES_IN,
        });
    } catch (error) {
        console.error("Error generating refresh token:", error);
        throw new Error("Error generating refresh token");
    }
};

/**
 * Verificar y decodificar un access token JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object} Payload decodificado
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new Error("Token expired");
        } else if (error.name === "JsonWebTokenError") {
            throw new Error("Invalid token");
        }
        throw new Error("Token verification failed");
    }
};

/**
 * Verificar y decodificar un refresh token JWT
 * @param {string} token - Refresh Token JWT a verificar
 * @returns {Object} Payload decodificado
 */
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new Error("Refresh token expired");
        } else if (error.name === "JsonWebTokenError") {
            throw new Error("Invalid refresh token");
        }
        throw new Error("Refresh token verification failed");
    }
};

/**
 * Obtener fecha de expiración del refresh token
 * @returns {Date} Fecha de expiración
 */
const getRefreshTokenExpiration = () => {
    const expiresIn = JWT_REFRESH_EXPIRES_IN;
    const now = new Date();

    // Parse the expiration string (e.g., "7d", "24h", "60m")
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (!match) {
        // Default to 7 days
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case "d":
            return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
        case "h":
            return new Date(now.getTime() + value * 60 * 60 * 1000);
        case "m":
            return new Date(now.getTime() + value * 60 * 1000);
        case "s":
            return new Date(now.getTime() + value * 1000);
        default:
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
};

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    getRefreshTokenExpiration,
};
