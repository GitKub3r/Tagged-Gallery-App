const { pool } = require("../config/database");

// Conexión de un usuario con su Google Drive. El refresh token se guarda cifrado y nunca sale del backend.
class GoogleDriveConnectionModel {
    static async ensureTable() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS google_drive_connections (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                google_account_email VARCHAR(255) NULL,
                refresh_token_encrypted TEXT NOT NULL,
                scopes TEXT NOT NULL,
                status ENUM('connected', 'revoked', 'error') NOT NULL DEFAULT 'connected',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_google_drive_connection_user (user_id),
                CONSTRAINT fk_google_drive_connections_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);
    }

    static async findByUserId(userId) {
        const [rows] = await pool.query(
            "SELECT id, user_id, google_account_email, refresh_token_encrypted, scopes, status, created_at, updated_at FROM google_drive_connections WHERE user_id = ?",
            [userId],
        );
        return rows[0] || null;
    }

    static async upsert({ userId, email, refreshTokenEncrypted, scopes }) {
        await pool.query(
            `INSERT INTO google_drive_connections (user_id, google_account_email, refresh_token_encrypted, scopes, status)
             VALUES (?, ?, ?, ?, 'connected')
             ON DUPLICATE KEY UPDATE
                google_account_email = VALUES(google_account_email),
                refresh_token_encrypted = VALUES(refresh_token_encrypted),
                scopes = VALUES(scopes),
                status = 'connected'`,
            [userId, email, refreshTokenEncrypted, scopes],
        );
        return this.findByUserId(userId);
    }

    static async updateStatus(userId, status) {
        await pool.query("UPDATE google_drive_connections SET status = ? WHERE user_id = ?", [status, userId]);
    }

    static async deleteByUserId(userId) {
        await pool.query("DELETE FROM google_drive_connections WHERE user_id = ?", [userId]);
    }

    static async markUserMediaStatus(userId, status) {
        await pool.query("UPDATE media SET storage_status = ? WHERE user_id = ? AND storage_provider = 'google_drive'", [
            status,
            userId,
        ]);
    }
}

module.exports = GoogleDriveConnectionModel;
