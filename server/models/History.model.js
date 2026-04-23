const { pool } = require("../config/database");

const MYSQL_DATETIME_REGEX = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/;

const normalizeTimestampToIsoUtc = (value) => {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }

    const asString = String(value).trim();
    if (!asString) {
        return null;
    }

    const mysqlMatch = MYSQL_DATETIME_REGEX.exec(asString);

    if (mysqlMatch) {
        const [, datePart, timePart, fraction = ""] = mysqlMatch;
        const milliseconds = `${fraction}000`.slice(0, 3);
        return `${datePart}T${timePart}.${milliseconds}Z`;
    }

    const parsed = new Date(asString);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }

    return asString;
};

class HistoryModel {
    static getSpainLocalTimestamp() {
        const now = new Date();
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Madrid",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            hourCycle: "h23",
        }).formatToParts(now);

        const year = parts.find((p) => p.type === "year")?.value;
        const month = parts.find((p) => p.type === "month")?.value;
        const day = parts.find((p) => p.type === "day")?.value;
        const hour = parts.find((p) => p.type === "hour")?.value;
        const minute = parts.find((p) => p.type === "minute")?.value;
        const second = parts.find((p) => p.type === "second")?.value;

        if (!year || !month || !day || !hour || !minute || !second) {
            return new Date().toISOString();
        }

        // Return format that MySQL datetime accepts: YYYY-MM-DD HH:MM:SS
        return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }

    static async create(entry) {
        const {
            actionid = null,
            action_code = null,
            userid = null,
            status_code = 200,
            message = null,
            request_method = null,
            request_path = null,
            ip_address = null,
            user_agent = null,
            metadata = null,
        } = entry;

        const metadataValue = metadata === null || metadata === undefined ? null : JSON.stringify(metadata);
        const spainTimestamp = this.getSpainLocalTimestamp();

        const [result] = await pool.query(
            `INSERT INTO history (
                actionid,
                action_code,
                userid,
                status_code,
                message,
                request_method,
                request_path,
                ip_address,
                user_agent,
                metadata,
                date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                actionid,
                action_code,
                userid,
                status_code,
                message,
                request_method,
                request_path,
                ip_address,
                user_agent,
                metadataValue,
                spainTimestamp,
            ],
        );

        return result.insertId;
    }

    static async countByActionId(actionId) {
        const [rows] = await pool.query("SELECT COUNT(*) AS total FROM history WHERE actionid = ?", [actionId]);
        return Number(rows[0]?.total || 0);
    }

    static async findAll(filters = {}) {
        const { page = 1, pageSize = 30, dateFrom, dateTo, search, actionCode, statusCode, statusGroup } = filters;

        const safePage = Number(page) > 0 ? Number(page) : 1;
        const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 30));
        const offset = (safePage - 1) * safePageSize;

        const conditions = [];
        const values = [];

        if (dateFrom) {
            conditions.push("h.date >= ?");
            values.push(`${dateFrom} 00:00:00`);
        }

        if (dateTo) {
            conditions.push("h.date <= ?");
            values.push(`${dateTo} 23:59:59`);
        }

        if (actionCode) {
            conditions.push("h.action_code = ?");
            values.push(actionCode);
        }

        if (statusCode) {
            conditions.push("CAST(h.status_code AS CHAR) LIKE ?");
            values.push(`%${String(statusCode).trim()}%`);
        }

        if (statusGroup === "success") {
            conditions.push("h.status_code BETWEEN 200 AND 299");
        }

        if (statusGroup === "client_error") {
            conditions.push("h.status_code BETWEEN 400 AND 499");
        }

        if (statusGroup === "server_error") {
            conditions.push("h.status_code >= 500");
        }

        if (search) {
            conditions.push(`(
                u.username LIKE ? OR
                a.actionname LIKE ? OR
                h.action_code LIKE ? OR
                h.message LIKE ? OR
                h.request_path LIKE ?
            )`);
            const likeValue = `%${search}%`;
            values.push(likeValue, likeValue, likeValue, likeValue, likeValue);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const [rows] = await pool.query(
            `SELECT
                h.id,
                h.actionid,
                h.action_code,
                a.actionname,
                h.userid,
                u.username,
                h.status_code,
                h.message,
                h.request_method,
                h.request_path,
                h.ip_address,
                h.user_agent,
                h.metadata,
                h.date
             FROM history h
             LEFT JOIN actions a ON a.id = h.actionid
             LEFT JOIN users u ON u.id = h.userid
             ${whereClause}
             ORDER BY h.id DESC
             LIMIT ? OFFSET ?`,
            [...values, safePageSize, offset],
        );

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM history h
             LEFT JOIN actions a ON a.id = h.actionid
             LEFT JOIN users u ON u.id = h.userid
             ${whereClause}`,
            values,
        );

        const total = Number(countRows[0]?.total || 0);

        return {
            data: rows.map((row) => ({
                ...row,
                date: normalizeTimestampToIsoUtc(row.date),
                metadata:
                    typeof row.metadata === "string" && row.metadata.length > 0
                        ? (() => {
                              try {
                                  return JSON.parse(row.metadata);
                              } catch {
                                  return row.metadata;
                              }
                          })()
                        : row.metadata,
            })),
            pagination: {
                page: safePage,
                pageSize: safePageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / safePageSize)),
            },
        };
    }

    static async findAvailableDates(filters = {}) {
        const { search, actionCode, statusCode, statusGroup, limit = 60 } = filters;
        const safeLimit = Math.min(365, Math.max(1, Number(limit) || 60));

        const conditions = [];
        const values = [];

        if (actionCode) {
            conditions.push("h.action_code = ?");
            values.push(actionCode);
        }

        if (statusCode) {
            conditions.push("CAST(h.status_code AS CHAR) LIKE ?");
            values.push(`%${String(statusCode).trim()}%`);
        }

        if (statusGroup === "success") {
            conditions.push("h.status_code BETWEEN 200 AND 299");
        }

        if (statusGroup === "client_error") {
            conditions.push("h.status_code BETWEEN 400 AND 499");
        }

        if (statusGroup === "server_error") {
            conditions.push("h.status_code >= 500");
        }

        if (search) {
            conditions.push(`(
                u.username LIKE ? OR
                a.actionname LIKE ? OR
                h.action_code LIKE ? OR
                h.message LIKE ? OR
                h.request_path LIKE ?
            )`);
            const likeValue = `%${search}%`;
            values.push(likeValue, likeValue, likeValue, likeValue, likeValue);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const [rows] = await pool.query(
            `SELECT
                DATE(h.date) AS log_date,
                COUNT(*) AS total_logs,
                SUM(CASE WHEN h.status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success_logs,
                SUM(CASE WHEN h.status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS client_error_logs,
                SUM(CASE WHEN h.status_code >= 500 THEN 1 ELSE 0 END) AS server_error_logs
             FROM history h
             LEFT JOIN actions a ON a.id = h.actionid
             LEFT JOIN users u ON u.id = h.userid
             ${whereClause}
             GROUP BY DATE(h.date)
             ORDER BY log_date DESC
             LIMIT ?`,
            [...values, safeLimit],
        );

        return rows;
    }
}

module.exports = HistoryModel;
