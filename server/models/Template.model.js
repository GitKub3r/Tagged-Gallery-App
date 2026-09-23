const { pool } = require("../config/database");

const parseTags = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const toTemplate = (row) => row && ({
    id: row.id,
    name: row.name,
    displayname: row.displayname,
    author: row.author,
    tags: parseTags(row.tag_names),
    mark_favourite: Boolean(row.mark_favourite),
    created_at: row.created_at,
    updated_at: row.updated_at,
});

class TemplateModel {
    static async ensureTable() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_templates (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                name VARCHAR(100) NOT NULL,
                displayname VARCHAR(255) NOT NULL DEFAULT '',
                author VARCHAR(100) NOT NULL DEFAULT '',
                tag_names JSON NOT NULL,
                mark_favourite BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_template_name (user_id, name),
                INDEX idx_media_templates_user_id (user_id),
                CONSTRAINT fk_media_templates_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);
        const [columns] = await pool.query("SHOW COLUMNS FROM media_templates LIKE 'mark_favourite'");
        if (columns.length === 0) {
            await pool.query("ALTER TABLE media_templates ADD COLUMN mark_favourite BOOLEAN NOT NULL DEFAULT FALSE AFTER tag_names");
        }
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(
            "SELECT id, name, displayname, author, tag_names, mark_favourite, created_at, updated_at FROM media_templates WHERE user_id = ? ORDER BY name ASC, id ASC",
            [userId],
        );
        return rows.map(toTemplate);
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(
            "SELECT id, name, displayname, author, tag_names, mark_favourite, created_at, updated_at FROM media_templates WHERE id = ? AND user_id = ?",
            [id, userId],
        );
        return toTemplate(rows[0]);
    }

    static async create(userId, template) {
        const [result] = await pool.query(
            "INSERT INTO media_templates (user_id, name, displayname, author, tag_names, mark_favourite) VALUES (?, ?, ?, ?, ?, ?)",
            [userId, template.name, template.displayname, template.author, JSON.stringify(template.tags), Boolean(template.mark_favourite)],
        );
        return this.findByIdForUser(result.insertId, userId);
    }

    static async update(id, userId, template) {
        const [result] = await pool.query(
            "UPDATE media_templates SET name = ?, displayname = ?, author = ?, tag_names = ?, mark_favourite = COALESCE(?, mark_favourite) WHERE id = ? AND user_id = ?",
            [template.name, template.displayname, template.author, JSON.stringify(template.tags), template.mark_favourite ?? null, id, userId],
        );
        return result.affectedRows ? this.findByIdForUser(id, userId) : null;
    }

    static async delete(id, userId) {
        const [result] = await pool.query("DELETE FROM media_templates WHERE id = ? AND user_id = ?", [id, userId]);
        return result.affectedRows > 0;
    }
}

module.exports = TemplateModel;
