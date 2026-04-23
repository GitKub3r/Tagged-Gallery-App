const { pool } = require("../config/database");

class ActionModel {
    static async findAll({ includeInactive = true } = {}) {
        const whereClause = includeInactive ? "" : "WHERE is_active = 1";
        const [rows] = await pool.query(
            `SELECT id, actionname, actioncode, description, is_active, created_at, updated_at
             FROM actions
             ${whereClause}
             ORDER BY actionname ASC`,
        );
        return rows;
    }

    static async findByCode(actionCode) {
        const [rows] = await pool.query(
            "SELECT id, actionname, actioncode, description, is_active, created_at, updated_at FROM actions WHERE actioncode = ? LIMIT 1",
            [actionCode],
        );
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            "SELECT id, actionname, actioncode, description, is_active, created_at, updated_at FROM actions WHERE id = ? LIMIT 1",
            [id],
        );
        return rows[0] || null;
    }

    static async create({ actionname, actioncode, description = null, is_active = true }) {
        const [result] = await pool.query(
            "INSERT INTO actions (actionname, actioncode, description, is_active) VALUES (?, ?, ?, ?)",
            [actionname, actioncode, description, is_active ? 1 : 0],
        );

        return this.findById(result.insertId);
    }

    static async update(id, payload) {
        const fields = [];
        const values = [];

        if (payload.actionname !== undefined) {
            fields.push("actionname = ?");
            values.push(payload.actionname);
        }

        if (payload.actioncode !== undefined) {
            fields.push("actioncode = ?");
            values.push(payload.actioncode);
        }

        if (payload.description !== undefined) {
            fields.push("description = ?");
            values.push(payload.description);
        }

        if (payload.is_active !== undefined) {
            fields.push("is_active = ?");
            values.push(payload.is_active ? 1 : 0);
        }

        if (fields.length === 0) {
            return this.findById(id);
        }

        values.push(id);
        await pool.query(`UPDATE actions SET ${fields.join(", ")} WHERE id = ?`, values);
        return this.findById(id);
    }

    static async delete(id) {
        const [result] = await pool.query("DELETE FROM actions WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }
}

module.exports = ActionModel;
