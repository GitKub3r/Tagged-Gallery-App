const { pool } = require("../config/database");

class UserModel {
    /**
     * Obtener todos los usuarios
     */
    static async findAll() {
        const [rows] = await pool.query("SELECT id, username, email, type, created_at FROM users");
        return rows;
    }

    /**
     * Buscar usuario por ID
     */
    static async findById(id) {
        const [rows] = await pool.query("SELECT id, username, email, type, created_at FROM users WHERE id = ?", [id]);
        return rows[0];
    }

    /**
     * Buscar usuario por email
     */
    static async findByEmail(email) {
        const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        return rows[0];
    }

    /**
     * Buscar usuario por username
     */
    static async findByUsername(username) {
        const [rows] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
        return rows[0];
    }

    /**
     * Crear un nuevo usuario
     */
    static async create(userData) {
        const { username, email, password, type = "basic" } = userData;

        const [result] = await pool.query("INSERT INTO users (username, email, password, type) VALUES (?, ?, ?, ?)", [
            username,
            email,
            password,
            type,
        ]);

        return {
            id: result.insertId,
            username,
            email,
            type,
        };
    }

    /**
     * Actualizar usuario
     */
    static async update(id, userData) {
        const fields = [];
        const values = [];

        if (userData.username !== undefined) {
            fields.push("username = ?");
            values.push(userData.username);
        }
        if (userData.email !== undefined) {
            fields.push("email = ?");
            values.push(userData.email);
        }
        if (userData.password !== undefined) {
            fields.push("password = ?");
            values.push(userData.password);
        }
        if (userData.type !== undefined) {
            fields.push("type = ?");
            values.push(userData.type);
        }

        if (fields.length === 0) {
            return null;
        }

        values.push(id);

        const [result] = await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

        return result.affectedRows > 0;
    }

    /**
     * Eliminar usuario
     */
    static async delete(id) {
        const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }

    /**
     * Verificar si existe un email
     */
    static async emailExists(email) {
        const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
        return rows.length > 0;
    }

    /**
     * Verificar si existe un username
     */
    static async usernameExists(username) {
        const [rows] = await pool.query("SELECT id FROM users WHERE username = ?", [username]);
        return rows.length > 0;
    }
}

module.exports = UserModel;
