const UserModel = require("../models/User.model");
const bcrypt = require("bcrypt");
const { generateToken, generateRefreshToken, getRefreshTokenExpiration } = require("../utils/jwt");
const RefreshTokenModel = require("../models/RefreshToken.model");

class UserService {
    /**
     * Obtener todos los usuarios
     */
    static async getAllUsers() {
        try {
            const users = await UserModel.findAll();
            return {
                success: true,
                data: users,
            };
        } catch (error) {
            console.error("Error in getAllUsers:", error);
            throw new Error("Error fetching users");
        }
    }

    /**
     * Obtener usuario por ID
     */
    static async getUserById(id) {
        try {
            const user = await UserModel.findById(id);

            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                };
            }

            return {
                success: true,
                data: user,
            };
        } catch (error) {
            console.error("Error in getUserById:", error);
            throw new Error("Error fetching user");
        }
    }

    /**
     * Crear un nuevo usuario
     */
    static async createUser(userData) {
        try {
            const { username, email, password, type } = userData;

            // Validaciones
            if (!username || !email || !password) {
                return {
                    success: false,
                    message: "Username, email and password are required",
                };
            }

            // Validar formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return {
                    success: false,
                    message: "Invalid email format",
                };
            }

            // Validar longitud de username
            if (username.length < 3 || username.length > 50) {
                return {
                    success: false,
                    message: "Username must be between 3 and 50 characters",
                };
            }

            // Validar longitud de password
            if (password.length < 6) {
                return {
                    success: false,
                    message: "Password must be at least 6 characters",
                };
            }

            // Verificar si el email ya existe
            const emailExists = await UserModel.emailExists(email);
            if (emailExists) {
                return {
                    success: false,
                    message: "Email already registered",
                };
            }

            // Verificar si el username ya existe
            const usernameExists = await UserModel.usernameExists(username);
            if (usernameExists) {
                return {
                    success: false,
                    message: "Username already in use",
                };
            }

            // Hashear la contraseña
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Crear usuario
            const newUser = await UserModel.create({
                username,
                email,
                password: hashedPassword,
                type: type || "basic",
            });

            return {
                success: true,
                data: newUser,
                message: "User created successfully",
            };
        } catch (error) {
            console.error("Error in createUser:", error);
            throw new Error("Error creating user");
        }
    }

    /**
     * Actualizar usuario
     */
    static async updateUser(id, userData) {
        try {
            // Verificar que el usuario existe
            const existingUser = await UserModel.findById(id);
            if (!existingUser) {
                return {
                    success: false,
                    message: "User not found",
                };
            }

            // Si se proporciona un nuevo email, verificar que no esté en uso
            if (userData.email && userData.email !== existingUser.email) {
                const emailExists = await UserModel.emailExists(userData.email);
                if (emailExists) {
                    return {
                        success: false,
                        message: "Email already in use",
                    };
                }
            }

            // Si se proporciona un nuevo username, verificar que no esté en uso
            if (userData.username && userData.username !== existingUser.username) {
                const usernameExists = await UserModel.usernameExists(userData.username);
                if (usernameExists) {
                    return {
                        success: false,
                        message: "Username already in use",
                    };
                }
            }

            // Si se proporciona una nueva contraseña, hashearla
            if (userData.password) {
                const saltRounds = 10;
                userData.password = await bcrypt.hash(userData.password, saltRounds);
            }

            const updated = await UserModel.update(id, userData);

            if (!updated) {
                return {
                    success: false,
                    message: "No changes were made",
                };
            }

            const updatedUser = await UserModel.findById(id);

            return {
                success: true,
                data: updatedUser,
                message: "User updated successfully",
            };
        } catch (error) {
            console.error("Error in updateUser:", error);
            throw new Error("Error updating user");
        }
    }

    /**
     * Eliminar usuario
     */
    static async deleteUser(id) {
        try {
            const user = await UserModel.findById(id);
            if (!user) {
                return {
                    success: false,
                    message: "User not found",
                };
            }

            const deleted = await UserModel.delete(id);

            if (!deleted) {
                return {
                    success: false,
                    message: "Error deleting user",
                };
            }

            return {
                success: true,
                message: "User deleted successfully",
            };
        } catch (error) {
            console.error("Error in deleteUser:", error);
            throw new Error("Error deleting user");
        }
    }

    /**
     * Login de usuario
     */
    static async loginUser(credentials) {
        try {
            const { email, password } = credentials;

            // Validaciones
            if (!email || !password) {
                return {
                    success: false,
                    message: "Email and password are required",
                };
            }

            // Buscar usuario por email
            const user = await UserModel.findByEmail(email);

            if (!user) {
                return {
                    success: false,
                    message: "Invalid credentials",
                };
            }

            // Verificar contraseña
            const isPasswordValid = await bcrypt.compare(password, user.password);

            if (!isPasswordValid) {
                return {
                    success: false,
                    message: "Invalid credentials",
                };
            }

            // Eliminar la contraseña del objeto de respuesta
            const { password: _, ...userWithoutPassword } = user;

            // Generar access token y refresh token
            const accessToken = generateToken({
                id: user.id,
                email: user.email,
                type: user.type,
            });

            const refreshToken = generateRefreshToken({
                id: user.id,
            });

            // Guardar refresh token en la base de datos
            const expiresAt = getRefreshTokenExpiration();
            await RefreshTokenModel.create({
                token: refreshToken,
                userid: user.id,
                expires_at: expiresAt,
            });

            return {
                success: true,
                data: {
                    user: userWithoutPassword,
                    accessToken,
                    refreshToken,
                },
                message: "Login successful",
            };
        } catch (error) {
            console.error("Error in loginUser:", error);
            throw new Error("Error during login");
        }
    }

    /**
     * Verificar contraseña
     */
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = UserService;
