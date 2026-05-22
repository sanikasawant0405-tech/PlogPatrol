const mysql = require("mysql2/promise");

const databaseName = process.env.DB_NAME || "plogpatrol_db";

const baseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    waitForConnections: true,
    connectionLimit: 10,    
    queueLimit: 0
};

let pool;

async function ensureColumnExists(tableName, columnName, definition) {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);

    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
    }
}

async function ensureColumnDefinition(tableName, columnName, definition) {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);

    if (rows.length === 0) {
        await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
        return;
    }

    await pool.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${definition}`);
}

async function initializeDatabase() {
    const connection = await mysql.createConnection({
        host: baseConfig.host,
        port: baseConfig.port,
        user: baseConfig.user,
        password: baseConfig.password
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    await connection.end();

    pool = mysql.createPool({
        ...baseConfig,
        database: databaseName
    });

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user (
            u_srno INT AUTO_INCREMENT PRIMARY KEY,
            u_uid VARCHAR(100) NOT NULL UNIQUE,
            u_password VARCHAR(255) NOT NULL,
            u_securityque VARCHAR(255) NOT NULL,
            u_securityans VARCHAR(255) NOT NULL,
            u_name VARCHAR(255) DEFAULT NULL,
            u_age INT DEFAULT NULL,
            u_mobno VARCHAR(20) DEFAULT NULL,
            u_address TEXT DEFAULT NULL,
            u_mailid VARCHAR(255) DEFAULT NULL,
            u_gender VARCHAR(20) DEFAULT NULL,
            u_dob DATE DEFAULT NULL,
            has_personal_info BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await ensureColumnExists("user", "has_personal_info", "BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumnExists("user", "created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumnDefinition("user", "u_password", "VARCHAR(255) NOT NULL");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS donorlogin (
            d_srno INT AUTO_INCREMENT PRIMARY KEY,
            d_userid VARCHAR(100) NOT NULL UNIQUE,
            d_password VARCHAR(255) NOT NULL,
            d_securityques VARCHAR(255) NOT NULL,
            d_securityans VARCHAR(255) NOT NULL,
            d_name VARCHAR(255) DEFAULT NULL,
            d_age INT DEFAULT NULL,
            d_mobno VARCHAR(20) DEFAULT NULL,
            d_mailid VARCHAR(255) DEFAULT NULL,
            d_gender VARCHAR(20) DEFAULT NULL,
            d_dob DATE DEFAULT NULL,
            has_personal_info BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await ensureColumnExists("donorlogin", "has_personal_info", "BOOLEAN NOT NULL DEFAULT FALSE");
    await ensureColumnExists("donorlogin", "created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumnDefinition("donorlogin", "d_password", "VARCHAR(255) NOT NULL");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS eventschedule (
            e_srno INT AUTO_INCREMENT PRIMARY KEY,
            e_name VARCHAR(255) NOT NULL,
            e_date DATE NOT NULL,
            e_day VARCHAR(20) NOT NULL,
            e_time VARCHAR(20) NOT NULL,
            e_loc VARCHAR(255) NOT NULL,
            e_desc TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await ensureColumnExists("eventschedule", "created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS userevents (
            ue_srno INT AUTO_INCREMENT PRIMARY KEY,
            e_eno INT NOT NULL,
            u_uname VARCHAR(100) NOT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_event_user (e_eno, u_uname)
        )
    `);

    await ensureColumnExists("userevents", "joined_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS donationhistory (
            donation_id INT AUTO_INCREMENT PRIMARY KEY,
            donor_userid VARCHAR(100) NOT NULL,
            donor_name VARCHAR(255) DEFAULT NULL,
            donation_type VARCHAR(30) NOT NULL,
            receipt_no VARCHAR(80) NOT NULL UNIQUE,
            transaction_id VARCHAR(100) DEFAULT NULL,
            amount DECIMAL(10, 2) DEFAULT NULL,
            payment_mode VARCHAR(100) DEFAULT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'Submitted',
            total_quantity INT DEFAULT NULL,
            donor_phone VARCHAR(20) DEFAULT NULL,
            collection_date DATE DEFAULT NULL,
            collection_address TEXT DEFAULT NULL,
            items_json TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_donationhistory_donor (donor_userid),
            INDEX idx_donationhistory_type (donation_type)
        )
    `);

    await ensureColumnExists("donationhistory", "donor_name", "VARCHAR(255) DEFAULT NULL");
    await ensureColumnExists("donationhistory", "transaction_id", "VARCHAR(100) DEFAULT NULL");
    await ensureColumnExists("donationhistory", "amount", "DECIMAL(10, 2) DEFAULT NULL");
    await ensureColumnExists("donationhistory", "payment_mode", "VARCHAR(100) DEFAULT NULL");
    await ensureColumnExists("donationhistory", "status", "VARCHAR(50) NOT NULL DEFAULT 'Submitted'");
    await ensureColumnExists("donationhistory", "total_quantity", "INT DEFAULT NULL");
    await ensureColumnExists("donationhistory", "donor_phone", "VARCHAR(20) DEFAULT NULL");
    await ensureColumnExists("donationhistory", "collection_date", "DATE DEFAULT NULL");
    await ensureColumnExists("donationhistory", "collection_address", "TEXT DEFAULT NULL");
    await ensureColumnExists("donationhistory", "items_json", "TEXT DEFAULT NULL");
    await ensureColumnExists("donationhistory", "created_at", "TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");

    return pool;
}

function getPool() {
    if (!pool) {
        throw new Error("Database has not been initialized yet.");
    }

    return pool;
}

async function query(sql, params = []) {
    return getPool().query(sql, params);
}

async function execute(sql, params = []) {
    return getPool().execute(sql, params);
}

module.exports = {
    databaseName,
    initializeDatabase,
    getPool,
    query,
    execute
};
