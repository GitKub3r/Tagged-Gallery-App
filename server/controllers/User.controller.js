const UserService = require("../services/User.service");
const AuditService = require("../services/Audit.service");

const ensureAdmin = (req, res) => {
    if (req.user?.type !== "admin") {
        AuditService.logEvent({
            actionCode: "AUTH_FORBIDDEN",
            req,
            userId: req.user?.id || null,
            statusCode: 403,
            message: "Administrator access required",
        });
        res.status(403).json({
            success: false,
            message: "Administrator access required",
        });
        return false;
    }

    return true;
};

class UserController {
    static async getMe(req, res) {
        try {
            const result = await UserService.getUserById(req.user.id);

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error("Error in UserController.getMe:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async updateMediaSearchPreference(req, res) {
        try {
            const result = await UserService.updateMediaSearchPreference(req.user.id, req.body?.matchMode);
            const statusCode = result.success ? 200 : 400;
            await AuditService.logEvent({
                actionCode: "PROFILE_UPDATE",
                req,
                statusCode,
                message: result.success ? "Media search preference updated successfully" : "Media search preference update failed",
                metadata: { changedFields: ["media_name_match_mode"] },
            });
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error("Error in UserController.updateMediaSearchPreference:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async resetAvatar(req, res) {
        try {
            const result = await UserService.resetAvatar(req.user.id);
            const statusCode = result.success ? 200 : 404;
            await AuditService.logEvent({
                actionCode: "PROFILE_AVATAR_RESET",
                req,
                statusCode,
                message: result.success ? "Profile image removed successfully" : "Profile image removal failed",
            });
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error("Error in UserController.resetAvatar:", error);
            await AuditService.logEvent({ actionCode: "PROFILE_AVATAR_RESET", req, statusCode: 500, message: "Profile image removal failed" });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async updateAvatar(req, res) {
        try {
            const result = await UserService.updateAvatar(req.user.id, req.file);
            const statusCode = result.success ? 200 : 400;
            await AuditService.logEvent({
                actionCode: "PROFILE_AVATAR_UPDATE",
                req,
                statusCode,
                message: result.success ? "Profile image updated successfully" : "Profile image update failed",
                metadata: req.file ? { mimeType: req.file.mimetype, size: req.file.size } : null,
            });
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error("Error in UserController.updateAvatar:", error);
            await AuditService.logEvent({ actionCode: "PROFILE_AVATAR_UPDATE", req, statusCode: 500, message: "Profile image update failed" });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async updateMe(req, res) {
        try {
            const result = await UserService.updateOwnProfile(req.user.id, req.body);
            const statusCode = result.success ? 200 : 400;
            await AuditService.logEvent({
                actionCode: "PROFILE_UPDATE",
                req,
                statusCode,
                message: result.success ? "Profile details updated successfully" : "Profile details update failed",
                metadata: { changedFields: ["username", "email"].filter((field) => req.body[field] !== undefined) },
            });
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error("Error in UserController.updateMe:", error);
            await AuditService.logEvent({ actionCode: "PROFILE_UPDATE", req, statusCode: 500, message: "Profile details update failed" });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    static async changeOwnPassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const result = await UserService.changeOwnPassword(req.user.id, currentPassword, newPassword);
            const statusCode = result.success ? 200 : 400;
            await AuditService.logEvent({
                actionCode: "PROFILE_PASSWORD_UPDATE",
                req,
                statusCode,
                message: result.success ? "Account password changed successfully" : "Account password change failed",
            });
            return res.status(statusCode).json(result);
        } catch (error) {
            console.error("Error in UserController.changeOwnPassword:", error);
            await AuditService.logEvent({ actionCode: "PROFILE_PASSWORD_UPDATE", req, statusCode: 500, message: "Account password change failed" });
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    /**
     * GET /api/v1/users
     * Obtener todos los usuarios
     */
    static async getAll(req, res) {
        try {
            if (!ensureAdmin(req, res)) {
                return;
            }

            const result = await UserService.getAllUsers();
            res.json(result);
        } catch (error) {
            console.error("Error in UserController.getAll:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * GET /api/v1/users/:id
     * Obtener usuario por ID
     */
    static async getById(req, res) {
        try {
            if (!ensureAdmin(req, res)) {
                return;
            }

            const { id } = req.params;
            const result = await UserService.getUserById(id);

            if (!result.success) {
                return res.status(404).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error("Error in UserController.getById:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * POST /api/v1/users
     * Crear un nuevo usuario
     */
    static async create(req, res) {
        try {
            const userData = req.body;
            const result = await UserService.createUser(userData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(201).json(result);
        } catch (error) {
            console.error("Error in UserController.create:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * PUT /api/v1/users/:id
     * Actualizar usuario
     */
    static async update(req, res) {
        try {
            if (!ensureAdmin(req, res)) {
                return;
            }

            const { id } = req.params;
            const userData = req.body;
            const result = await UserService.updateUser(id, userData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error("Error in UserController.update:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * DELETE /api/v1/users/:id
     * Eliminar usuario
     */
    static async delete(req, res) {
        try {
            if (!ensureAdmin(req, res)) {
                return;
            }

            const { id } = req.params;
            const result = await UserService.deleteUser(id);

            if (!result.success) {
                return res.status(404).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error("Error in UserController.delete:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    /**
     * POST /api/v1/users/login
     * Login de usuario
     */
    static async login(req, res) {
        try {
            const credentials = req.body;
            const result = await UserService.loginUser(credentials);

            if (!result.success) {
                return res.status(401).json(result);
            }

            res.json(result);
        } catch (error) {
            console.error("Error in UserController.login:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
}

module.exports = UserController;
