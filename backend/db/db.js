const Database = require("better-sqlite3");

// creates DB file if it doesn't exist
const path = require("path");
const db = new Database(path.join(__dirname, "database.db"));

db.prepare(
  `CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razao_social TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    ie TEXT,
    rua TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    telefone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
    )`,
).run();

module.exports = db;
