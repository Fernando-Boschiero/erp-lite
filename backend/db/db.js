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

module.exports = db;
