const { pool } = require("../config/database");

class UserModel {
    /**
     * Obtener todos los usuarios
     */
    static async findAll() {
        const [rows] = await pool.query("SELECT id, username, email, type, avatar_path, media_name_match_mode, session_version, created_at FROM users");
        return rows;
    }

    /**
     * Buscar usuario por ID
     */
    static async findById(id) {
        const [rows] = await pool.query("SELECT id, username, email, type, avatar_path, media_name_match_mode, session_version, created_at FROM users WHERE id = ?", [id]);
        return rows[0];
    }

    static async findByIdWithPassword(id) {
        const [rows] = await pool.query("SELECT id, username, email, password, type, avatar_path, media_name_match_mode, session_version, created_at FROM users WHERE id = ?", [id]);
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
        if (userData.avatar_path !== undefined) {
            fields.push("avatar_path = ?");
            values.push(userData.avatar_path);
        }
        if (userData.media_name_match_mode !== undefined) {
            fields.push("media_name_match_mode = ?");
            values.push(userData.media_name_match_mode);
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

    static async ensureAvatarColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'avatar_path'");
        if (columns.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN avatar_path VARCHAR(500) NULL AFTER type");
        }
    }

    static async ensureSessionVersionColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'session_version'");
        if (columns.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER avatar_path");
        }
    }

    static async ensureMediaNameMatchModeColumn() {
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'media_name_match_mode'");
        if (columns.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN media_name_match_mode VARCHAR(10) NOT NULL DEFAULT 'normal' AFTER avatar_path");
        }
    }

    static async incrementSessionVersion(id) {
        const [result] = await pool.query("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }
}

module.exports = UserModel;
