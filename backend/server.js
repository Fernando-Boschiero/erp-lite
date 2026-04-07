// import express framework
const express = require("express");

// import database connection
const db = require("./db/db");

const path = require("path");

// create an express app (your server)
const app = express();

// define port server will run on
const PORT = 3000;

// middleware - parse incoming JSON requests
app.use(express.json());

app.use(express.static(path.join(__dirname, "../frontend")));

// GET - fetch all active suppliers
app.get("/fornecedores", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM fornecedores WHERE is_active = 1")
    .all();
  res.json(rows);
});

// POST - register new supplier
app.post("/fornecedores", (req, res) => {
  const { razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone } =
    req.body;
  try {
    db.prepare(
      `INSERT INTO fornecedores (razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed: fornecedores.cnpj")) {
      res.status(409).json({ error: "Um fornecedor com este CNPJ já existe." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT - update existing supplier
app.put("/fornecedores/:id", (req, res) => {
  const { razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone } =
    req.body;
  db.prepare(
    `UPDATE fornecedores SET razao_social=?, cnpj=?, ie=?, rua=?, bairro=?, cidade=?, estado=?, cep=?, telefone=?
     WHERE id=?`,
  ).run(
    razao_social,
    cnpj,
    ie,
    rua,
    bairro,
    cidade,
    estado,
    cep,
    telefone,
    req.params.id,
  );
  res.json({ success: true });
});

// PATCH - toggle active/inactive
app.patch("/fornecedores/:id/status", (req, res) => {
  const { is_active } = req.body;
  try {
    db.prepare(`UPDATE fornecedores SET is_active = ? WHERE id = ?`).run(
      is_active,
      req.params.id,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - soft delete (marks as inactive)
app.delete("/fornecedores/:id", (req, res) => {
  try {
    db.prepare(`UPDATE fornecedores SET is_active = 0 WHERE id = ?`).run(
      req.params.id,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch all orders (joins supplier name for convenience)
// JOIN means: for each pedido, also grab the razao_social from fornecedores where ids match
app.get("/pedidos", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT pedidos.*, fornecedores.razao_social
    FROM pedidos
    JOIN fornecedores ON pedidos.fornecedor_id = fornecedores.id
  `,
    )
    .all();
  res.json(rows);
});

// GET - fetch one order with all its line items
app.get("/pedidos/:id", (req, res) => {
  const pedido = db
    .prepare(`SELECT * FROM pedidos WHERE id = ?`)
    .get(req.params.id);

  if (!pedido) return res.status(404).json({ error: "Pedido não encontrado." });

  // fetch all line items belonging to this order
  const itens = db
    .prepare(`SELECT * FROM pedido_itens WHERE pedido_id = ?`)
    .all(req.params.id);

  // send back the order and its items together
  res.json({ ...pedido, itens });
});

// POST - create a new order with its line items
app.post("/pedidos", (req, res) => {
  const {
    num_pedido,
    data_pedido,
    fornecedor_id,
    prazo_entrega,
    num_proposta,
    cond_pagamento,
    observacoes,
    aplicacao,
    endereco_entrega,
    itens, // itens is an array of line items
  } = req.body;

  try {
    // use a transaction so that if anything fails, nothing gets saved
    // either everything saves or nothing does
    const transaction = db.transaction(() => {
      const result = db
        .prepare(
          `
        INSERT INTO pedidos (num_pedido, data_pedido, fornecedor_id, prazo_entrega,
          num_proposta, cond_pagamento, observacoes, aplicacao, endereco_entrega)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          num_pedido,
          data_pedido,
          fornecedor_id,
          prazo_entrega,
          num_proposta,
          cond_pagamento,
          observacoes,
          aplicacao,
          endereco_entrega,
        );

      const pedidoId = result.lastInsertRowid; // id of the order we just created

      // loop through each line item and insert it linked to this order
      for (const item of itens) {
        db.prepare(
          `
          INSERT INTO pedido_itens (pedido_id, item, quantidade, descricao, unidade, val_unitario, ipi, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          pedidoId,
          item.item,
          item.quantidade,
          item.descricao,
          item.unidade,
          item.val_unitario,
          item.ipi,
          item.total,
        );
      }
    });

    transaction(); // execute the transaction
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed: pedidos.num_pedido")) {
      res.status(409).json({ error: "Um pedido com este número já existe." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT - update an existing order and replace its line items
app.put("/pedidos/:id", (req, res) => {
  const {
    num_pedido,
    data_pedido,
    fornecedor_id,
    prazo_entrega,
    num_proposta,
    cond_pagamento,
    observacoes,
    aplicacao,
    endereco_entrega,
    itens,
  } = req.body;

  try {
    const transaction = db.transaction(() => {
      db.prepare(
        `
        UPDATE pedidos SET num_pedido=?, data_pedido=?, fornecedor_id=?,
          prazo_entrega=?, num_proposta=?, cond_pagamento=?, observacoes=?,
          aplicacao=?, endereco_entrega=?, updated_at=datetime('now')
        WHERE id=?
      `,
      ).run(
        num_pedido,
        data_pedido,
        fornecedor_id,
        prazo_entrega,
        num_proposta,
        cond_pagamento,
        observacoes,
        aplicacao,
        endereco_entrega,
        req.params.id,
      );

      // delete existing items and reinsert — simplest way to handle edits
      db.prepare(`DELETE FROM pedido_itens WHERE pedido_id = ?`).run(
        req.params.id,
      );

      for (const item of itens) {
        db.prepare(
          `
          INSERT INTO pedido_itens (pedido_id, item, quantidade, descricao, unidade, val_unitario, ipi, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          req.params.id,
          item.item,
          item.quantidade,
          item.descricao,
          item.unidade,
          item.val_unitario,
          item.ipi,
          item.total,
        );
      }
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
