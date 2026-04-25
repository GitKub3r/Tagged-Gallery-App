const ActionModel = require("../models/Action.model");
const HistoryModel = require("../models/History.model");
const { pool } = require("../config/database");
const mysql = require("mysql2");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const LOGS_TIMEZONE = "Europe/Madrid";

const getSpainDateInputValue = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: LOGS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (!year || !month || !day) {
        return null;
    }

    return `${year}-${month}-${day}`;
};

class LogsService {
    static throwIfAborted(signal) {
        if (signal?.aborted) {
            const abortError = new Error("Backup generation aborted");
            abortError.name = "AbortError";
            throw abortError;
        }
    }

    static runProcess(command, args = [], { signal } = {}) {
        return new Promise((resolve, reject) => {
            this.throwIfAborted(signal);

            const child = spawn(command, args, {
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stderr = "";
            let settled = false;

            const finishReject = (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(error);
            };

            const finishResolve = () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            };

            const onAbort = () => {
                const abortError = new Error("Backup generation aborted");
                abortError.name = "AbortError";

                try {
                    child.kill("SIGTERM");
                } catch {
                    // no-op
                }

                finishReject(abortError);
            };

            if (signal) {
                if (signal.aborted) {
                    onAbort();
                    return;
                }

                signal.addEventListener("abort", onAbort, { once: true });
            }

            child.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });

            child.on("error", (error) => {
                finishReject(error);
            });

            child.on("close", (code) => {
                if (signal) {
                    signal.removeEventListener("abort", onAbort);
                }

                if (code === 0) {
                    finishResolve();
                    return;
                }

                const error = new Error(stderr.trim() || `${command} exited with code ${code}`);
                finishReject(error);
            });
        });
    }

    static async buildDatabaseDumpSql({ includeData = false, signal } = {}) {
        this.throwIfAborted(signal);
        const databaseName = String(process.env.DB_NAME || "").trim();

        if (!databaseName) {
            throw new Error("DB_NAME is not configured");
        }

        const [tableRows] = await pool.query(
            `SELECT TABLE_NAME
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = ?
               AND TABLE_TYPE = 'BASE TABLE'
             ORDER BY TABLE_NAME ASC`,
            [databaseName],
        );

        const tableNames = tableRows.map((row) => String(row.TABLE_NAME || "").trim()).filter(Boolean);
        const sqlChunks = [];

        sqlChunks.push("-- Tagged backup dump");
        sqlChunks.push(`-- Generated at: ${new Date().toISOString()}`);
        sqlChunks.push(`-- Database: ${databaseName}`);
        sqlChunks.push("");
        sqlChunks.push("SET NAMES utf8mb4;");
        sqlChunks.push("SET FOREIGN_KEY_CHECKS = 0;");
        sqlChunks.push("");

        for (const tableName of tableNames) {
            this.throwIfAborted(signal);
            const escapedTable = `\`${tableName.replace(/`/g, "``")}\``;
            const [createRows] = await pool.query(`SHOW CREATE TABLE ${escapedTable}`);
            const createRow = createRows?.[0] || {};
            const createStatement = createRow["Create Table"] || createRow["Create View"];

            if (!createStatement) {
                continue;
            }

            sqlChunks.push(`-- Structure for table ${tableName}`);
            sqlChunks.push(`DROP TABLE IF EXISTS ${escapedTable};`);
            sqlChunks.push(`${createStatement};`);
            sqlChunks.push("");

            if (!includeData) {
                continue;
            }

            const [dataRows] = await pool.query(`SELECT * FROM ${escapedTable}`);

            if (!Array.isArray(dataRows) || dataRows.length === 0) {
                continue;
            }

            const columnNames = Object.keys(dataRows[0] || {});
            const escapedColumns = columnNames.map((columnName) => `\`${String(columnName).replace(/`/g, "``")}\``);

            sqlChunks.push(`-- Data for table ${tableName}`);

            for (let index = 0; index < dataRows.length; index += 1) {
                if (index % 100 === 0) {
                    this.throwIfAborted(signal);
                }

                const row = dataRows[index];
                const valuesSql = columnNames.map((columnName) => mysql.escape(row[columnName]));
                sqlChunks.push(
                    `INSERT INTO ${escapedTable} (${escapedColumns.join(", ")}) VALUES (${valuesSql.join(", ")});`,
                );
            }

            sqlChunks.push("");
        }

        sqlChunks.push("SET FOREIGN_KEY_CHECKS = 1;");
        sqlChunks.push("");

        return sqlChunks.join("\n");
    }

    static async createZipArchive({ sourceDir, dumpFilePath, includeUploads, uploadsSourcePath, signal }) {
        this.throwIfAborted(signal);
        const zipPath = path.join(sourceDir, "backup.zip");
        const dumpDir = path.dirname(dumpFilePath);
        const dumpName = path.basename(dumpFilePath);
        let includeUploadsInArchive = false;

        if (includeUploads && uploadsSourcePath) {
            try {
                await fs.access(uploadsSourcePath);
                includeUploadsInArchive = true;
            } catch {
                includeUploadsInArchive = false;
            }
        }

        try {
            const tarArgs = ["-a", "-c", "-f", zipPath, "-C", dumpDir, dumpName];

            if (includeUploadsInArchive) {
                const uploadsRootDir = path.dirname(uploadsSourcePath);
                const uploadsDirName = path.basename(uploadsSourcePath);
                tarArgs.push("-C", uploadsRootDir, uploadsDirName);
            }

            await this.runProcess("tar", tarArgs, { signal });
            return zipPath;
        } catch {
            this.throwIfAborted(signal);

            const absoluteEntries = [dumpFilePath];

            if (includeUploadsInArchive) {
                absoluteEntries.push(uploadsSourcePath);
            }

            const escapedEntries = absoluteEntries.map((entry) => entry.replace(/'/g, "''"));
            const escapedZipPath = zipPath.replace(/'/g, "''");
            const script = `Compress-Archive -Path ${escapedEntries.map((entry) => `'${entry}'`).join(", ")} -DestinationPath '${escapedZipPath}' -Force`;

            await this.runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
                signal,
            });
            return zipPath;
        }
    }

    static async createDatabaseBackupArchive({ includeData = false, signal } = {}) {
        let tempDir = null;

        try {
            this.throwIfAborted(signal);
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tagged-backup-"));
            const dumpSql = await this.buildDatabaseDumpSql({ includeData, signal });
            const dumpFilePath = path.join(tempDir, "dump.sql");
            await fs.writeFile(dumpFilePath, dumpSql, "utf8");
            this.throwIfAborted(signal);

            const uploadsSourcePath = includeData ? path.join(__dirname, "..", "uploads") : null;
            const zipPath = await this.createZipArchive({
                sourceDir: tempDir,
                dumpFilePath,
                includeUploads: includeData,
                uploadsSourcePath,
                signal,
            });
            const now = new Date();
            const year = String(now.getFullYear());
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            const hours = String(now.getHours()).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            const seconds = String(now.getSeconds()).padStart(2, "0");
            const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
            const suffix = includeData ? "with-data" : "structure";
            const fileName = `tagged-backup-${suffix}-${timestamp}.zip`;

            return {
                filePath: zipPath,
                fileName,
                cleanup: async () => {
                    if (tempDir) {
                        await fs.rm(tempDir, { recursive: true, force: true });
                    }
                },
            };
        } catch (error) {
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
            throw error;
        }
    }

    static async getLogs(query = {}) {
        const result = await HistoryModel.findAll({
            page: query.page,
            pageSize: query.pageSize,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            search: query.search,
            actionCode: query.actionCode,
            statusCode: query.statusCode,
            statusGroup: query.statusGroup,
        });

        return {
            success: true,
            data: result.data,
            pagination: result.pagination,
        };
    }

    static async getTodayLogs(query = {}) {
        const today = getSpainDateInputValue();

        if (!today) {
            return this.getLogs(query);
        }

        return this.getLogs({
            ...query,
            dateFrom: today,
            dateTo: today,
        });
    }

    static async getLogDates(query = {}) {
        const rows = await HistoryModel.findAvailableDates({
            search: query.search,
            actionCode: query.actionCode,
            statusCode: query.statusCode,
            statusGroup: query.statusGroup,
            limit: query.limit,
        });

        return {
            success: true,
            data: rows,
        };
    }

    static async getActions() {
        const rows = await ActionModel.findAll({ includeInactive: true });
        return {
            success: true,
            data: rows,
        };
    }

    static normalizeActionCode(input) {
        return String(input || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");
    }

    static async createAction(payload) {
        const actionname = String(payload?.actionname || "").trim();
        const rawCode = payload?.actioncode;
        const actioncode = this.normalizeActionCode(rawCode || actionname);
        const description = payload?.description ? String(payload.description).trim() : null;

        if (!actionname) {
            return { success: false, message: "actionname is required" };
        }

        if (!actioncode) {
            return { success: false, message: "actioncode is required" };
        }

        try {
            const created = await ActionModel.create({
                actionname,
                actioncode,
                description,
                is_active: payload?.is_active !== false,
            });

            return {
                success: true,
                data: created,
            };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return {
                    success: false,
                    message: "actioncode already exists",
                };
            }
            throw error;
        }
    }

    static async updateAction(id, payload) {
        const current = await ActionModel.findById(id);
        if (!current) {
            return { success: false, message: "Action not found" };
        }

        const updatePayload = {};

        if (payload.actionname !== undefined) {
            const actionname = String(payload.actionname || "").trim();
            if (!actionname) {
                return { success: false, message: "actionname cannot be empty" };
            }
            updatePayload.actionname = actionname;
        }

        if (payload.actioncode !== undefined) {
            const actioncode = this.normalizeActionCode(payload.actioncode);
            if (!actioncode) {
                return { success: false, message: "actioncode cannot be empty" };
            }
            updatePayload.actioncode = actioncode;
        }

        if (payload.description !== undefined) {
            updatePayload.description = payload.description ? String(payload.description).trim() : null;
        }

        if (payload.is_active !== undefined) {
            updatePayload.is_active = Boolean(payload.is_active);
        }

        try {
            const updated = await ActionModel.update(id, updatePayload);

            return {
                success: true,
                data: updated,
            };
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return {
                    success: false,
                    message: "actioncode already exists",
                };
            }
            throw error;
        }
    }

    static async deleteAction(id) {
        const current = await ActionModel.findById(id);
        if (!current) {
            return { success: false, message: "Action not found" };
        }

        const usageCount = await HistoryModel.countByActionId(id);
        if (usageCount > 0) {
            return {
                success: false,
                message: "Cannot delete action because it is already used in history logs",
            };
        }

        await ActionModel.delete(id);

        return {
            success: true,
            message: "Action deleted",
        };
    }
}

module.exports = LogsService;
