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

// start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
