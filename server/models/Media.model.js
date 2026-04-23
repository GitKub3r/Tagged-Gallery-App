const { pool } = require("../config/database");

class MediaModel {
    static async ensureManagedValuesTables() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_displayname_values (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                displayname VARCHAR(255) NOT NULL,
                UNIQUE KEY unique_user_displayname (user_id, displayname),
                INDEX idx_media_displayname_values_user_id (user_id),
                CONSTRAINT fk_media_displayname_values_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_author_values (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                author VARCHAR(100) NOT NULL,
                UNIQUE KEY unique_user_author (user_id, author),
                INDEX idx_media_author_values_user_id (user_id),
                CONSTRAINT fk_media_author_values_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        `);
    }

    static async findAll() {
        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media ORDER BY id DESC",
        );
        return rows;
    }

    static async countAll() {
        const [[row]] = await pool.query("SELECT COUNT(*) AS total FROM media");
        return row.total;
    }

    static async findAllPaginated(page, limit) {
        const offset = (page - 1) * limit;
        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media ORDER BY id DESC LIMIT ? OFFSET ?",
            [limit, offset],
        );
        return rows;
    }

    static async findAllByUserId(userId) {
        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media WHERE user_id = ? ORDER BY id DESC",
            [userId],
        );
        return rows;
    }

    static async countByUserId(userId) {
        const [[row]] = await pool.query("SELECT COUNT(*) AS total FROM media WHERE user_id = ?", [userId]);
        return row.total;
    }

    static async findAllByUserIdPaginated(userId, page, limit) {
        const offset = (page - 1) * limit;
        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            [userId, limit, offset],
        );
        return rows;
    }

    static async findDistinctDisplayNames() {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS displayname, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(displayname) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE displayname IS NOT NULL AND TRIM(displayname) <> ''
                    GROUP BY TRIM(displayname)

                    UNION ALL

                    SELECT displayname AS value, 0 AS usage_count
                    FROM media_displayname_values
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
        );
        return rows;
    }

    static async findDistinctDisplayNamesByUserId(userId) {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS displayname, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(displayname) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE user_id = ? AND displayname IS NOT NULL AND TRIM(displayname) <> ''
                    GROUP BY TRIM(displayname)

                    UNION ALL

                    SELECT displayname AS value, 0 AS usage_count
                    FROM media_displayname_values
                    WHERE user_id = ?
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
            [userId, userId],
        );
        return rows;
    }

    static async findDistinctAuthors() {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS author, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(author) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE author IS NOT NULL AND TRIM(author) <> ''
                    GROUP BY TRIM(author)

                    UNION ALL

                    SELECT author AS value, 0 AS usage_count
                    FROM media_author_values
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
        );
        return rows;
    }

    static async findDistinctAuthorsByUserId(userId) {
        await this.ensureManagedValuesTables();

        const [rows] = await pool.query(
            `
                SELECT value AS author, SUM(usage_count) AS usage_count
                FROM (
                    SELECT TRIM(author) AS value, COUNT(*) AS usage_count
                    FROM media
                    WHERE user_id = ? AND author IS NOT NULL AND TRIM(author) <> ''
                    GROUP BY TRIM(author)

                    UNION ALL

                    SELECT author AS value, 0 AS usage_count
                    FROM media_author_values
                    WHERE user_id = ?
                ) AS values_union
                GROUP BY value
                ORDER BY value ASC
            `,
            [userId, userId],
        );
        return rows;
    }

    static async createManagedDisplayName(userId, displayname) {
        await this.ensureManagedValuesTables();
        await pool.query("INSERT IGNORE INTO media_displayname_values (user_id, displayname) VALUES (?, ?)", [
            userId,
            displayname,
        ]);
    }

    static async renameManagedDisplayNameForUser(userId, previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query(
            "UPDATE media SET displayname = ? WHERE user_id = ? AND TRIM(displayname) = ?",
            [nextValue, userId, previousValue],
        );

        await pool.query("DELETE FROM media_displayname_values WHERE user_id = ? AND displayname = ?", [
            userId,
            previousValue,
        ]);
        await pool.query("INSERT IGNORE INTO media_displayname_values (user_id, displayname) VALUES (?, ?)", [
            userId,
            nextValue,
        ]);

        return result.affectedRows || 0;
    }

    static async renameManagedDisplayName(previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET displayname = ? WHERE TRIM(displayname) = ?", [
            nextValue,
            previousValue,
        ]);

        await pool.query("DELETE FROM media_displayname_values WHERE displayname = ?", [previousValue]);
        await pool.query("INSERT IGNORE INTO media_displayname_values (user_id, displayname) SELECT id, ? FROM users", [
            nextValue,
        ]);

        return result.affectedRows || 0;
    }

    static async deleteManagedDisplayNameForUser(userId, valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query(
            "UPDATE media SET displayname = CONCAT('Untitled ', id) WHERE user_id = ? AND TRIM(displayname) = ?",
            [userId, valueToDelete],
        );

        await pool.query("DELETE FROM media_displayname_values WHERE user_id = ? AND displayname = ?", [
            userId,
            valueToDelete,
        ]);

        return result.affectedRows || 0;
    }

    static async deleteManagedDisplayName(valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query(
            "UPDATE media SET displayname = CONCAT('Untitled ', id) WHERE TRIM(displayname) = ?",
            [valueToDelete],
        );

        await pool.query("DELETE FROM media_displayname_values WHERE displayname = ?", [valueToDelete]);

        return result.affectedRows || 0;
    }

    static async createManagedAuthor(userId, author) {
        await this.ensureManagedValuesTables();
        await pool.query("INSERT IGNORE INTO media_author_values (user_id, author) VALUES (?, ?)", [userId, author]);
    }

    static async renameManagedAuthorForUser(userId, previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = ? WHERE user_id = ? AND TRIM(author) = ?", [
            nextValue,
            userId,
            previousValue,
        ]);

        await pool.query("DELETE FROM media_author_values WHERE user_id = ? AND author = ?", [userId, previousValue]);
        await pool.query("INSERT IGNORE INTO media_author_values (user_id, author) VALUES (?, ?)", [userId, nextValue]);

        return result.affectedRows || 0;
    }

    static async renameManagedAuthor(previousValue, nextValue) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = ? WHERE TRIM(author) = ?", [
            nextValue,
            previousValue,
        ]);

        await pool.query("DELETE FROM media_author_values WHERE author = ?", [previousValue]);
        await pool.query("INSERT IGNORE INTO media_author_values (user_id, author) SELECT id, ? FROM users", [
            nextValue,
        ]);

        return result.affectedRows || 0;
    }

    static async deleteManagedAuthorForUser(userId, valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = NULL WHERE user_id = ? AND TRIM(author) = ?", [
            userId,
            valueToDelete,
        ]);

        await pool.query("DELETE FROM media_author_values WHERE user_id = ? AND author = ?", [userId, valueToDelete]);

        return result.affectedRows || 0;
    }

    static async deleteManagedAuthor(valueToDelete) {
        await this.ensureManagedValuesTables();

        const [result] = await pool.query("UPDATE media SET author = NULL WHERE TRIM(author) = ?", [valueToDelete]);

        await pool.query("DELETE FROM media_author_values WHERE author = ?", [valueToDelete]);

        return result.affectedRows || 0;
    }

    static async create(mediaData) {
        const { user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite } =
            mediaData;
        const normalizedDisplayName =
            displayname === undefined || displayname === null || displayname === "" ? null : displayname;
        const normalizedAuthor = author === undefined || author === null || author === "" ? null : author;

        const [result] = await pool.query(
            "INSERT INTO media (user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                user_id,
                normalizedDisplayName,
                normalizedAuthor,
                filename,
                size,
                filepath,
                thumbpath,
                mediatype,
                Boolean(is_favourite),
            ],
        );

        return {
            id: result.insertId,
            user_id,
            displayname: normalizedDisplayName,
            author: normalizedAuthor,
            filename,
            size,
            filepath,
            thumbpath,
            mediatype,
            is_favourite: Boolean(is_favourite),
        };
    }

    static async findByIdForUser(id, userId) {
        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media WHERE id = ? AND user_id = ?",
            [id, userId],
        );
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media WHERE id = ?",
            [id],
        );
        return rows[0];
    }

    static async findByIds(ids) {
        if (!ids || ids.length === 0) {
            return [];
        }

        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media WHERE id IN (?)",
            [ids],
        );
        return rows;
    }

    static async findByIdsForUser(ids, userId) {
        if (!ids || ids.length === 0) {
            return [];
        }

        const [rows] = await pool.query(
            "SELECT id, user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite, updatedAt FROM media WHERE id IN (?) AND user_id = ?",
            [ids, userId],
        );
        return rows;
    }

    static async toggleFavourite(id) {
        const [result] = await pool.query("UPDATE media SET is_favourite = NOT is_favourite WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }

    static async update(id, fields) {
        const parts = [];
        const values = [];

        if (fields.displayname !== undefined) {
            parts.push("displayname = ?");
            values.push(fields.displayname);
        }
        if (fields.author !== undefined) {
            parts.push("author = ?");
            values.push(fields.author);
        }

        if (parts.length === 0) return null;

        values.push(id);
        const [result] = await pool.query(`UPDATE media SET ${parts.join(", ")} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await pool.query("DELETE FROM media WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }

    static async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            return 0;
        }

        const [result] = await pool.query("DELETE FROM media WHERE id IN (?)", [ids]);
        return result.affectedRows || 0;
    }

    static async createMany(mediaList) {
        if (!mediaList.length) {
            return [];
        }

        const values = mediaList.map((item) => [
            item.user_id,
            item.displayname === undefined || item.displayname === null || item.displayname === ""
                ? null
                : item.displayname,
            item.author === undefined || item.author === null || item.author === "" ? null : item.author,
            item.filename,
            item.size,
            item.filepath,
            item.thumbpath,
            item.mediatype,
            Boolean(item.is_favourite),
        ]);

        const [result] = await pool.query(
            "INSERT INTO media (user_id, displayname, author, filename, size, filepath, thumbpath, mediatype, is_favourite) VALUES ?",
            [values],
        );

        return mediaList.map((item, index) => ({
            id: result.insertId + index,
            ...item,
        }));
    }
}

module.exports = MediaModel;
