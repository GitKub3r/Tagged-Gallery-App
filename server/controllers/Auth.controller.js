const AuthService = require("../services/Auth.service");

class AuthController {
    /**
     * POST /api/v1/auth/refresh
     * Refrescar el access token
     */
    static async refresh(req, res) {
        try {
            const { refreshToken } = req.body;
            const result = await AuthService.refreshAccessToken(refreshToken);

            if (!result.success) {
                return res.status(401).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error("Error in AuthController.refresh:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * POST /api/v1/auth/logout
     * Logout - eliminar refresh token
     */
    static async logout(req, res) {
        try {
            const { refreshToken } = req.body;
            const result = await AuthService.logout(refreshToken);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error("Error in AuthController.logout:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * POST /api/v1/auth/logout-all
     * Logout de todos los dispositivos
     */
    static async logoutAll(req, res) {
        try {
            // req.user viene del middleware authenticate
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }

            const result = await AuthService.logoutAll(req.user.id);
            res.json(result);
        } catch (error) {
            console.error("Error in AuthController.logoutAll:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
}

module.exports = AuthController;
