const { pool } = require("../config/database");

class RefreshTokenModel {
    /**
     * Crear un nuevo refresh token
     */
    static async create(tokenData) {
        const { token, userid, expires_at } = tokenData;

        const [result] = await pool.query("INSERT INTO refresh_tokens (token, userid, expires_at) VALUES (?, ?, ?)", [
            token,
            userid,
            expires_at,
        ]);

        return {
            id: result.insertId,
            token,
            userid,
            expires_at,
        };
    }

    /**
     * Buscar refresh token
     */
    static async findByToken(token) {
        const [rows] = await pool.query("SELECT * FROM refresh_tokens WHERE token = ?", [token]);
        return rows[0];
    }

    /**
     * Eliminar refresh token específico
     */
    static async deleteByToken(token) {
        const [result] = await pool.query("DELETE FROM refresh_tokens WHERE token = ?", [token]);
        return result.affectedRows > 0;
    }

    /**
     * Eliminar todos los tokens de un usuario
     */
    static async deleteByUserId(userid) {
        const [result] = await pool.query("DELETE FROM refresh_tokens WHERE userid = ?", [userid]);
        return result.affectedRows;
    }

    /**
     * Eliminar tokens expirados
     */
    static async deleteExpired() {
        const [result] = await pool.query("DELETE FROM refresh_tokens WHERE expires_at < NOW()");
        return result.affectedRows;
    }

    /**
     * Verificar si un token existe y no ha expirado
     */
    static async isValid(token) {
        const [rows] = await pool.query("SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()", [token]);
        return rows.length > 0;
    }
}

module.exports = RefreshTokenModel;
