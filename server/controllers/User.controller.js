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
