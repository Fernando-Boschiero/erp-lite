const Database = require("better-sqlite3");
const path = require("path");
const db = new Database(path.join(__dirname, "database.db"));

// existing table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS fornecedores (
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
  )
`,
).run();

// new table: one row per purchase order
// REFERENCES fornecedores(id) means this column must match an existing id in fornecedores
// ON DELETE RESTRICT prevents deleting a supplier that has orders attached
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    num_pedido TEXT NOT NULL UNIQUE,
    data_pedido TEXT,
    fornecedor_id INTEGER NOT NULL,
    prazo_entrega TEXT,
    num_proposta TEXT,
    cond_pagamento TEXT,
    observacoes TEXT,
    aplicacao TEXT,
    endereco_entrega TEXT,
    comprador TEXT,
    comprador_email TEXT,
    comprador_telefone TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id) ON DELETE RESTRICT
  )
`,
).run();

// new table: one row per line item inside an order
// REFERENCES pedidos(id) links each item back to its parent order
// ON DELETE CASCADE means if an order is deleted, its items are automatically deleted too
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    item INTEGER,
    quantidade REAL,
    descricao TEXT,
    unidade TEXT,
    val_unitario REAL,
    ipi REAL,
    total REAL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
  )
`,
).run();

module.exports = db;
