const mysql = require("mysql2/promise");

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX) || 10,
    queueLimit: 0,
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Función para conectar a la base de datos
const connectDB = async () => {
    try {
        console.log("🔄 Attempting to connect to database...");
        console.log(`📍 Host: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`🗄️  Database: ${dbConfig.database}`);

        // Verificar la conexión
        const connection = await pool.getConnection();

        console.log("✅ Database connection established successfully");
        console.log(`👤 User: ${dbConfig.user}`);

        // Liberar la conexión de vuelta al pool
        connection.release();

        return pool;
    } catch (error) {
        console.error("❌ Error connecting to database:");
        console.error(`   Message: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.error(`   Host: ${dbConfig.host}:${dbConfig.port}`);

        // Lanzar el error para que el servidor no arranque si la BD no está disponible
        throw error;
    }
};

module.exports = { pool, connectDB };
