const { pool } = require("../config/database");
const { sanitizeGraph } = require("../utils/ruleGraph");

const RULE_COLUMNS = "id, name, is_active, graph, applied_count, last_applied_at, created_at, updated_at";

// Se vuelve a sanear al leer: así el editor y el motor reciben siempre el formato actual de cada nodo
// (p. ej. "values" en las condiciones de nombre y autor, que antes guardaban un solo "value").
const parseGraph = (value) => {
    try {
        const graph = typeof value === "string" ? JSON.parse(value) : value;
        return sanitizeGraph(graph).data || { nodes: [], edges: [] };
    } catch {
        return { nodes: [], edges: [] };
    }
};

const toRule = (row) => row && ({
    id: row.id,
    name: row.name,
    is_active: Boolean(row.is_active),
    graph: parseGraph(row.graph),
    applied_count: Number(row.applied_count) || 0,
    last_applied_at: row.last_applied_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

class RuleModel {
    static async ensureTable() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_rules (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                name VARCHAR(100) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT FALSE,
                graph JSON NOT NULL,
                applied_count INT UNSIGNED NOT NULL DEFAULT 0,
                last_applied_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_rule_name (user_id, name),
                INDEX idx_media_rules_user_active (user_id, is_active),
                CONSTRAINT fk_media_rules_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(`SELECT ${RULE_COLUMNS} FROM media_rules WHERE user_id = ? ORDER BY name ASC, id ASC`, [userId]);
        return rows.map(toRule);
    }

    // Reglas activas en orden de creación: cada una ve los cambios de las anteriores.
    static async findActiveByUserId(userId) {
        const [rows] = await pool.query(`SELECT ${RULE_COLUMNS} FROM media_rules WHERE user_id = ? AND is_active = TRUE ORDER BY id ASC`, [userId]);
        return rows.map(toRule);
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(`SELECT ${RULE_COLUMNS} FROM media_rules WHERE id = ? AND user_id = ?`, [id, userId]);
        return toRule(rows[0]);
    }

    static async create(userId, { name, is_active, graph }) {
        const [result] = await pool.query("INSERT INTO media_rules (user_id, name, is_active, graph) VALUES (?, ?, ?, ?)", [
            userId,
            name,
            Boolean(is_active),
            JSON.stringify(graph),
        ]);
        return this.findByIdForUser(result.insertId, userId);
    }

    static async update(id, userId, { name, is_active, graph }) {
        const [result] = await pool.query("UPDATE media_rules SET name = ?, is_active = ?, graph = ? WHERE id = ? AND user_id = ?", [
            name,
            Boolean(is_active),
            JSON.stringify(graph),
            id,
            userId,
        ]);
        return result.affectedRows ? this.findByIdForUser(id, userId) : null;
    }

    static async delete(id, userId) {
        const [result] = await pool.query("DELETE FROM media_rules WHERE id = ? AND user_id = ?", [id, userId]);
        return result.affectedRows > 0;
    }

    // Cuenta las medias que cambió cada regla. updated_at = updated_at: aplicar una regla no la "edita".
    static async recordApplications(countsByRuleId) {
        for (const [ruleId, count] of countsByRuleId) {
            await pool.query(
                "UPDATE media_rules SET applied_count = applied_count + ?, last_applied_at = NOW(), updated_at = updated_at WHERE id = ?",
                [count, ruleId],
            );
        }
    }
}

module.exports = RuleModel;
