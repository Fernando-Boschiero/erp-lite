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

// COTAÇÕES - one row per quotation
// A new row is created for each revision, linked by num_cotacao
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS cotacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Identification
    num_cotacao TEXT NOT NULL,        -- e.g. COT-BRICAPAR-2026-1974
    revisao INTEGER NOT NULL DEFAULT 0, -- 0 = original, 1 = Rev.1, etc.
    status TEXT NOT NULL DEFAULT 'Criada', -- Criada | Em Análise Técnica | Em Análise Financeira | Enviado ao Cliente

    -- Client info
    cliente TEXT NOT NULL,            -- free text for now, until clientes table exists
    cliente_contato TEXT,             -- e.g. Sr. Marcelo Solis
    cliente_email TEXT,               -- e.g. marcelo.solis@cliente.com

    -- Document content
    objetivo TEXT,                    -- free text / rich text (Quill HTML)
    descricao_equipamentos TEXT,      -- rich text (Quill HTML) - main body with images
    condicoes_proposta TEXT,          -- rich text (Quill HTML) - prazo, pagamento, frete, etc.
    observacoes TEXT,                 -- any additional notes

    -- Commercial conditions
    prazo_entrega TEXT,
    cond_pagamento TEXT,
    validade_proposta TEXT,           -- e.g. "15 dias"
    moeda TEXT DEFAULT 'BRL',        -- BRL or USD

    -- Boilerplate
    condicoes_gerais TEXT,            -- pre-filled with standard text, editable if needed

    -- Responsible
    comprador TEXT,
    comprador_email TEXT,
    comprador_telefone TEXT,

    -- Metadata
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`,
).run();

// COTAÇÃO ITENS - one row per line item in the commercial proposal table
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS cotacao_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cotacao_id INTEGER NOT NULL,      -- links to cotacoes.id
    item INTEGER,                     -- item number
    quantidade REAL,
    descricao TEXT,
    unidade TEXT,
    val_unitario REAL,
    moeda TEXT DEFAULT 'BRL',
    total REAL,
    FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE
  )
`,
).run();

// COTAÇÃO STATUS LOG - tracks every status change for accountability
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS cotacao_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cotacao_id INTEGER NOT NULL,      -- links to cotacoes.id
    status_anterior TEXT,             -- what the status was before
    status_novo TEXT,                 -- what it changed to
    alterado_por TEXT,                -- who made the change (free text until users table exists)
    alterado_em TEXT DEFAULT (datetime('now')), -- when it was changed
    observacao TEXT,                  -- optional note explaining the change
    FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE CASCADE
  )
`,
).run();

// update pedidos table to add status and comprador fields
// since the table may already exist, we use ALTER TABLE to add missing columns
try {
  db.prepare(
    `ALTER TABLE pedidos ADD COLUMN status TEXT DEFAULT 'Criado'`,
  ).run();
} catch (e) {}
try {
  db.prepare(`ALTER TABLE pedidos ADD COLUMN comprador TEXT`).run();
} catch (e) {}
try {
  db.prepare(`ALTER TABLE pedidos ADD COLUMN comprador_email TEXT`).run();
} catch (e) {}
try {
  db.prepare(`ALTER TABLE pedidos ADD COLUMN comprador_telefone TEXT`).run();
} catch (e) {}

// pedido status log - tracks every status change
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS pedido_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    alterado_por TEXT,
    alterado_em TEXT DEFAULT (datetime('now')),
    observacao TEXT,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
  )
`,
).run();

// pedido anexos - stores file attachments linked to a pedido
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS pedido_anexos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    nome_original TEXT NOT NULL,   -- original filename as uploaded
    nome_arquivo TEXT NOT NULL,    -- stored filename on server (uuid to avoid conflicts)
    caminho TEXT NOT NULL,         -- full path on server
    tipo TEXT,                     -- mime type e.g. application/pdf, image/jpeg
    tamanho INTEGER,               -- file size in bytes
    uploaded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
  )
`,
).run();

module.exports = db;
