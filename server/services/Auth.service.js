const { verifyRefreshToken, generateToken } = require("../utils/jwt");
const RefreshTokenModel = require("../models/RefreshToken.model");
const UserModel = require("../models/User.model");

class AuthService {
    /**
     * Refrescar el access token usando un refresh token
     */
    static async refreshAccessToken(refreshToken) {
        try {
            if (!refreshToken) {
                return {
                    success: false,
                    message: "Refresh token required",
                };
            }

            // Verificar que el token existe en la BD
            const tokenInDb = await RefreshTokenModel.findByToken(refreshToken);

            if (!tokenInDb) {
                return {
                    success: false,
                    message: "Invalid refresh token",
                };
            }

            // Verificar que el token no haya expirado en la BD
            const isValid = await RefreshTokenModel.isValid(refreshToken);

            if (!isValid) {
                // Eliminar token expirado
                await RefreshTokenModel.deleteByToken(refreshToken);
                return {
                    success: false,
                    message: "Refresh token expired",
                };
            }

            // Verificar el token JWT
            let decoded;
            try {
                decoded = verifyRefreshToken(refreshToken);
            } catch (error) {
                // Token inválido o expirado, eliminarlo de la BD
                await RefreshTokenModel.deleteByToken(refreshToken);
                return {
                    success: false,
                    message: error.message || "Invalid refresh token",
                };
            }

            // Verificar que el usuario aún existe
            const user = await UserModel.findById(decoded.id);

            if (!user) {
                await RefreshTokenModel.deleteByToken(refreshToken);
                return {
                    success: false,
                    message: "User not found",
                };
            }

            // Generar nuevo access token
            const newAccessToken = generateToken({
                id: user.id,
                email: user.email,
                type: user.type,
            });

            return {
                success: true,
                data: {
                    accessToken: newAccessToken,
                },
                message: "Access token refreshed successfully",
            };
        } catch (error) {
            console.error("Error in refreshAccessToken:", error);
            throw new Error("Error refreshing token");
        }
    }

    /**
     * Logout - eliminar refresh token
     */
    static async logout(refreshToken) {
        try {
            if (!refreshToken) {
                return {
                    success: false,
                    message: "Refresh token required",
                };
            }

            const deleted = await RefreshTokenModel.deleteByToken(refreshToken);

            if (!deleted) {
                return {
                    success: false,
                    message: "Refresh token not found",
                };
            }

            return {
                success: true,
                message: "Logout successful",
            };
        } catch (error) {
            console.error("Error in logout:", error);
            throw new Error("Error during logout");
        }
    }

    /**
     * Logout de todos los dispositivos - eliminar todos los refresh tokens del usuario
     */
    static async logoutAll(userId) {
        try {
            const deleted = await RefreshTokenModel.deleteByUserId(userId);

            return {
                success: true,
                message: `Logout successful from ${deleted} device(s)`,
            };
        } catch (error) {
            console.error("Error in logoutAll:", error);
            throw new Error("Error during logout");
        }
    }
}

module.exports = AuthService;
