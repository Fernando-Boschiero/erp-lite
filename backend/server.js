// import express framework
const express = require("express");

// import puppeteer
const puppeteer = require("puppeteer");

// import database connection
const db = require("./db/db");
const fs = require("fs");
const path = require("path");

const multer = require("multer");
const { v4: uuidv4 } = require("crypto");
const fsSync = require("fs");
const uploadDir = path.join(__dirname, "../backend/uploads/pedidos");

// create uploads folder if it doesn't exist
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
}

// multer config - stores files with a unique name to avoid conflicts
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20mb limit
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use PDF, JPG ou PNG."));
    }
  },
});

// create an express app (your server)
const app = express();

// define port server will run on
const PORT = 3000;

// middleware - parse incoming JSON requests
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Função para formatar a data em PT-BR
function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

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

// GET - fetch all cotações (latest revision only, for listing)
app.get("/cotacoes", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT c1.*
    FROM cotacoes c1
    INNER JOIN (
      SELECT num_cotacao, MAX(revisao) as max_revisao
      FROM cotacoes
      GROUP BY num_cotacao
    ) c2
    ON c1.num_cotacao = c2.num_cotacao
    AND c1.revisao = c2.max_revisao
    WHERE c1.is_active = 1
    ORDER BY c1.created_at DESC
  `,
    )
    .all();
  res.json(rows);
});

// GET - fetch all revisions of a specific cotação
app.get("/cotacoes/:num_cotacao/revisoes", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT * FROM cotacoes
    WHERE num_cotacao = ?
    ORDER BY revisao ASC
  `,
    )
    .all(req.params.num_cotacao);
  res.json(rows);
});

// GET - fetch one specific cotação by id, with its line items and status log
app.get("/cotacoes/:id", (req, res) => {
  const cotacao = db
    .prepare(
      `
    SELECT * FROM cotacoes WHERE id = ?
  `,
    )
    .get(req.params.id);

  if (!cotacao)
    return res.status(404).json({ error: "Cotação não encontrada." });

  const itens = db
    .prepare(
      `
    SELECT * FROM cotacao_itens WHERE cotacao_id = ?
    ORDER BY item ASC
  `,
    )
    .all(req.params.id);

  const statusLog = db
    .prepare(
      `
    SELECT * FROM cotacao_status_log WHERE cotacao_id = ?
    ORDER BY alterado_em ASC
  `,
    )
    .all(req.params.id);

  res.json({ ...cotacao, itens, statusLog });
});

// POST - create a new cotação
app.post("/cotacoes", (req, res) => {
  const {
    num_cotacao,
    data_cotacao,
    cliente,
    cliente_contato,
    cliente_email,
    objetivo,
    descricao_equipamentos,
    condicoes_proposta,
    observacoes,
    prazo_entrega,
    cond_pagamento,
    validade_proposta,
    moeda,
    condicoes_gerais,
    comprador,
    comprador_email,
    comprador_telefone,
    alterado_por,
    itens,
  } = req.body;

  try {
    const transaction = db.transaction(() => {
      // insert the cotação
      const result = db
        .prepare(
          `
        INSERT INTO cotacoes (
          num_cotacao, data_cotacao, cliente, cliente_contato, cliente_email,
          objetivo, descricao_equipamentos, condicoes_proposta, observacoes,
          prazo_entrega, cond_pagamento, validade_proposta, moeda,
          condicoes_gerais, comprador, comprador_email, comprador_telefone,
          status, revisao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criada', 0)
      `,
        )
        .run(
          num_cotacao,
          data_cotacao,
          cliente,
          cliente_contato,
          cliente_email,
          objetivo,
          descricao_equipamentos,
          condicoes_proposta,
          observacoes,
          prazo_entrega,
          cond_pagamento,
          validade_proposta,
          moeda,
          condicoes_gerais,
          comprador,
          comprador_email,
          comprador_telefone,
        );

      const cotacaoId = result.lastInsertRowid;

      // insert line items
      for (const item of itens) {
        db.prepare(
          `
          INSERT INTO cotacao_itens (cotacao_id, item, quantidade, descricao, unidade, val_unitario, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          cotacaoId,
          item.item,
          item.quantidade,
          item.descricao,
          item.unidade,
          item.val_unitario,
          item.total,
        );
      }

      // log the initial status
      db.prepare(
        `
        INSERT INTO cotacao_status_log (cotacao_id, status_anterior, status_novo, alterado_por)
        VALUES (?, null, 'Criada', ?)
      `,
      ).run(cotacaoId, alterado_por);

      return cotacaoId;
    });

    const id = transaction();
    res.json({ success: true, id });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Uma cotação com este número já existe." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PUT - update an existing cotação (only allowed if not "Enviado ao Cliente")
app.put("/cotacoes/:id", (req, res) => {
  const {
    num_cotacao,
    data_cotacao,
    cliente,
    cliente_contato,
    cliente_email,
    objetivo,
    descricao_equipamentos,
    condicoes_proposta,
    observacoes,
    prazo_entrega,
    cond_pagamento,
    validade_proposta,
    moeda,
    condicoes_gerais,
    comprador,
    comprador_email,
    comprador_telefone,
    itens,
  } = req.body;

  try {
    // check current status — cannot edit if already sent to client or in final status
    const current = db
      .prepare(`SELECT status FROM cotacoes WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Cotação não encontrada." });

    if (
      [
        "Enviado ao Cliente",
        "Aceita",
        "Pausada",
        "Recusada",
        "Cancelada",
      ].includes(current.status)
    ) {
      return res.status(403).json({
        error:
          "Esta cotação não pode ser editada no status atual. Crie uma nova revisão se necessário.",
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(
        `
        UPDATE cotacoes SET
          num_cotacao=?, data_cotacao=?, cliente=?, cliente_contato=?, cliente_email=?,
          objetivo=?, descricao_equipamentos=?, condicoes_proposta=?, observacoes=?,
          prazo_entrega=?, cond_pagamento=?, validade_proposta=?, moeda=?,
          condicoes_gerais=?, comprador=?, comprador_email=?, comprador_telefone=?,
          updated_at=datetime('now')
        WHERE id=?
      `,
      ).run(
        num_cotacao,
        data_cotacao,
        cliente,
        cliente_contato,
        cliente_email,
        objetivo,
        descricao_equipamentos,
        condicoes_proposta,
        observacoes,
        prazo_entrega,
        cond_pagamento,
        validade_proposta,
        moeda,
        condicoes_gerais,
        comprador,
        comprador_email,
        comprador_telefone,
        req.params.id,
      );

      // replace line items
      db.prepare(`DELETE FROM cotacao_itens WHERE cotacao_id = ?`).run(
        req.params.id,
      );

      for (const item of itens) {
        db.prepare(
          `
          INSERT INTO cotacao_itens (cotacao_id, item, quantidade, descricao, unidade, val_unitario, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          req.params.id,
          item.item,
          item.quantidade,
          item.descricao,
          item.unidade,
          item.val_unitario,
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

// PATCH - update status only, and log the change
app.patch("/cotacoes/:id/status", (req, res) => {
  const { status_novo, alterado_por, observacao } = req.body;

  try {
    const current = db
      .prepare(`SELECT status FROM cotacoes WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Cotação não encontrada." });

    // define allowed transitions
    const transicoesPermitidas = {
      Criada: ["Em Análise Técnica", "Cancelada"],
      "Em Análise Técnica": ["Em Análise Financeira", "Criada", "Cancelada"],
      "Em Análise Financeira": [
        "Enviado ao Cliente",
        "Em Análise Técnica",
        "Cancelada",
      ],
      "Enviado ao Cliente": ["Aceita", "Recusada", "Cancelada"],
      Aceita: ["Pausada", "Cancelada"],
      Pausada: ["Aceita", "Cancelada"],
      Recusada: [],
      Cancelada: [],
    };

    const permitidas = transicoesPermitidas[current.status] || [];

    if (!permitidas.includes(status_novo)) {
      return res.status(403).json({
        error: `Não é possível mudar o status de "${current.status}" para "${status_novo}".`,
      });
    }

    const transaction = db.transaction(() => {
      // update status
      db.prepare(
        `
        UPDATE cotacoes SET status = ?, updated_at = datetime('now') WHERE id = ?
      `,
      ).run(status_novo, req.params.id);

      // log the change
      db.prepare(
        `
        INSERT INTO cotacao_status_log (cotacao_id, status_anterior, status_novo, alterado_por, observacao)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(
        req.params.id,
        current.status,
        status_novo,
        alterado_por,
        observacao,
      );
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - create a new revision of an existing cotação
// This copies the current cotação into a new row with revisao + 1
app.post("/cotacoes/:id/revisao", (req, res) => {
  const { alterado_por } = req.body;

  try {
    const current = db
      .prepare(`SELECT * FROM cotacoes WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Cotação não encontrada." });

    if (current.status !== "Enviado ao Cliente") {
      return res.status(403).json({
        error:
          "Só é possível criar uma nova revisão após a cotação ser enviada ao cliente.",
      });
    }

    const currentItens = db
      .prepare(
        `
      SELECT * FROM cotacao_itens WHERE cotacao_id = ?
    `,
      )
      .all(req.params.id);

    const transaction = db.transaction(() => {
      // insert new revision row, copying all fields, incrementing revisao
      const result = db
        .prepare(
          `
        INSERT INTO cotacoes (
          num_cotacao, data_cotacao, cliente, cliente_contato, cliente_email,
          objetivo, descricao_equipamentos, condicoes_proposta, observacoes,
          prazo_entrega, cond_pagamento, validade_proposta, moeda,
          condicoes_gerais, comprador, comprador_email, comprador_telefone,
          status, revisao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criada', ?)
      `,
        )
        .run(
          current.num_cotacao,
          current.data_cotacao,
          current.cliente,
          current.cliente_contato,
          current.cliente_email,
          current.objetivo,
          current.descricao_equipamentos,
          current.condicoes_proposta,
          current.observacoes,
          current.prazo_entrega,
          current.cond_pagamento,
          current.validade_proposta,
          current.moeda,
          current.condicoes_gerais,
          current.comprador,
          current.comprador_email,
          current.comprador_telefone,
          current.revisao + 1,
        );

      const novaId = result.lastInsertRowid;

      // copy line items to new revision
      for (const item of currentItens) {
        db.prepare(
          `
          INSERT INTO cotacao_itens (cotacao_id, item, quantidade, descricao, unidade, val_unitario, total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          novaId,
          item.item,
          item.quantidade,
          item.descricao,
          item.unidade,
          item.val_unitario,
          item.total,
        );
      }

      // log the new revision
      db.prepare(
        `
        INSERT INTO cotacao_status_log (cotacao_id, status_anterior, status_novo, alterado_por, observacao)
        VALUES (?, 'Enviado ao Cliente', 'Criada', ?, 'Nova revisão criada')
      `,
      ).run(novaId, alterado_por);

      return novaId;
    });

    const novaId = transaction();
    res.json({ success: true, id: novaId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - generate PDF for a cotação
app.get("/cotacoes/:id/pdf", async (req, res) => {
  try {
    const cotacao = db
      .prepare(`SELECT * FROM cotacoes WHERE id = ?`)
      .get(req.params.id);

    if (!cotacao)
      return res.status(404).json({ error: "Cotação não encontrada." });

    const itens = db
      .prepare(
        `SELECT * FROM cotacao_itens WHERE cotacao_id = ? ORDER BY item ASC`,
      )
      .all(req.params.id);

    const revisao = cotacao.revisao == 0 ? "Rev.0" : `Rev.${cotacao.revisao}`;
    const dataFormatada = formatarData(cotacao.data_cotacao);

    // LOGO
    const logoPath = path.join(
      __dirname,
      "../frontend/assets/Imagens/logo-veikonv-vetorizado.png",
    );
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");
    const logoSrc = `data:image/png;base64,${logoBase64}`;

    // FONTS
    const fontRegular = fs
      .readFileSync(
        path.join(__dirname, "../frontend/assets/fonts/Inter_18pt-Regular.ttf"),
      )
      .toString("base64");
    const fontBold = fs
      .readFileSync(
        path.join(__dirname, "../frontend/assets/fonts/Inter_18pt-Bold.ttf"),
      )
      .toString("base64");
    const fontItalic = fs
      .readFileSync(
        path.join(__dirname, "../frontend/assets/fonts/Inter_18pt-Italic.ttf"),
      )
      .toString("base64");
    const fontBoldItalic = fs
      .readFileSync(
        path.join(
          __dirname,
          "../frontend/assets/fonts/Inter_18pt-BoldItalic.ttf",
        ),
      )
      .toString("base64");

    // build the items table rows
    const itensHTML = itens
      .map(
        (item) => `
      <tr>
        <td>${item.item}</td>
        <td>${item.quantidade ?? ""}</td>
        <td>${item.descricao ?? ""}</td>
        <td>${item.unidade ?? ""}</td>
        <td>${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? ""}</td>
        <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? ""}</td>
      </tr>
    `,
      )
      .join("");

    // full HTML document for Puppeteer to render
    const html = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Inter';
    src: url(data:font/truetype;base64,${fontRegular});
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'Inter';
    src: url(data:font/truetype;base64,${fontBold});
    font-weight: bold;
    font-style: normal;
  }
  @font-face {
    font-family: 'Inter';
    src: url(data:font/truetype;base64,${fontItalic});
    font-weight: normal;
    font-style: italic;
  }
  @font-face {
    font-family: 'Inter';
    src: url(data:font/truetype;base64,${fontBoldItalic});
    font-weight: bold;
    font-style: italic;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; font-size: 10pt; color: #000; }

  h1 { font-size: 16pt; text-align: center; margin-bottom: 8mm; }
  h2 { font-size: 11pt; margin-top: 6mm; margin-bottom: 2mm; }
  hr { border: none; border-top: 1px solid #ccc; margin-bottom: 4mm; }

  .container-numdata { display: flex; gap: 10mm; margin-bottom: 6mm; }
  .column { flex: 1; }
  .column label { font-size: 8pt; font-weight: bold; display: block; }
  .column p { font-size: 10pt; }

  .two-col { display: flex; gap: 10mm; margin-bottom: 6mm; }
  .two-col .col { flex: 1; }
  .field label { font-size: 8pt; font-weight: bold; display: block; margin-top: 3mm; }
  .field p { font-size: 10pt; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 9pt; }
  th { background: #f0f0f0; padding: 2mm 3mm; text-align: left; border: 1px solid #ccc; font-size: 8pt; }
  td { padding: 2mm 3mm; border: 1px solid #ccc; }

  .total-geral { text-align: right; font-weight: bold; font-size: 11pt; margin-bottom: 6mm; }
  .quill-content { margin-bottom: 6mm; line-height: 1.5; }
  .quill-content p { margin-bottom: 2mm; }
  .quill-content ul, .quill-content ol { padding-left: 5mm; margin-bottom: 2mm; }

  .responsavel { display: flex; gap: 10mm; margin-bottom: 6mm; }
  .responsavel .field { flex: 1; }
</style>
      </head>
      <body>
        <h1>COTAÇÃO</h1>

        <div class="container-numdata">
          <div class="column">
            <label>NO. DA COTAÇÃO</label>
            <p>${cotacao.num_cotacao ?? "-"}</p>
          </div>
          <div class="column">
            <label>DATA</label>
            <p>${dataFormatada}</p>
          </div>
          <div class="column">
            <label>REVISÃO</label>
            <p>${revisao}</p>
          </div>
        </div>

        <div class="two-col">
          <div class="col">
            <h2>DADOS DO CLIENTE</h2>
            <hr>
            <div class="field"><label>CLIENTE</label><p>${cotacao.cliente ?? "-"}</p></div>
            <div class="two-col">
              <div class="field"><label>CONTATO</label><p>${cotacao.cliente_contato ?? "-"}</p></div>
              <div class="field"><label>EMAIL</label><p>${cotacao.cliente_email ?? "-"}</p></div>
            </div>
          </div>
          <div class="col">
            <h2>CONDIÇÕES COMERCIAIS</h2>
            <hr>
            <div class="two-col">
              <div class="field"><label>PRAZO DE ENTREGA</label><p>${cotacao.prazo_entrega ?? "-"}</p></div>
              <div class="field"><label>VALIDADE DA PROPOSTA</label><p>${cotacao.validade_proposta ?? "-"}</p></div>
            </div>
            <div class="two-col">
              <div class="field"><label>CONDIÇÃO DE PAGAMENTO</label><p>${cotacao.cond_pagamento ?? "-"}</p></div>
              <div class="field"><label>MOEDA</label><p>${cotacao.moeda ?? "BRL"}</p></div>
            </div>
          </div>
        </div>

        <h2>OBJETIVO</h2>
        <hr>
        <div class="field"><p>${cotacao.objetivo ?? "-"}</p></div>

        <h2>DESCRIÇÃO DOS EQUIPAMENTOS</h2>
        <hr>
        <div class="quill-content">${cotacao.descricao_equipamentos ?? ""}</div>

        <h2>PROPOSTA COMERCIAL</h2>
        <hr>
        <table>
          <thead>
            <tr>
              <th>ITEM</th>
              <th>QTD</th>
              <th>DESCRIÇÃO</th>
              <th>UNID.</th>
              <th>VALOR UNIT.</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
          </tbody>
        </table>
        <div class="total-geral">TOTAL GERAL: ${cotacao.moeda === "USD" ? "U$" : "R$"} ${itens
          .reduce((sum, item) => sum + (item.total ?? 0), 0)
          .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>

        <h2>CONDIÇÕES DA PROPOSTA</h2>
        <hr>
        <div class="quill-content">${cotacao.condicoes_proposta ?? ""}</div>

        <h2>RESPONSÁVEL PELA COTAÇÃO</h2>
        <hr>
        <div class="responsavel">
          <div class="field"><label>RESPONSÁVEL</label><p>${cotacao.comprador ?? "-"}</p></div>
          <div class="field"><label>EMAIL</label><p>${cotacao.comprador_email ?? "-"}</p></div>
          <div class="field"><label>TELEFONE</label><p>${cotacao.comprador_telefone ?? "-"}</p></div>
        </div>

        <h2>CONDIÇÕES GERAIS DE VENDA</h2>
        <hr>
        <div class="quill-content">${cotacao.condicoes_gerais ?? ""}</div>

      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "40mm", bottom: "20mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `
  <div style="width:100%; font-family: 'Inter', Arial, sans-serif; font-size: 9pt; padding: 3mm 10mm; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center;">
    <img src="${logoSrc}" style="height: 12mm;" />
    <div style="text-align: right; font-size: 8pt;">
      <strong>VEIKON EQUIPAMENTOS E SERVIÇOS LTDA</strong><br>
      CNPJ: 19.309.792/0001-09 / IE: 714.079.490.113<br>
      Rua Joana Fabri Thomé 442, Santa Claudina — Vinhedo - SP, CEP: 13284-432<br>
      Telefone: (19) 3846-6802 / Email: comercial@veikon.com.br
    </div>
  </div>
`,
      footerTemplate: `
  <div style="width:100%; font-family: 'Inter', Arial, sans-serif; font-size: 8pt; padding: 2mm 10mm; border-top: 1px solid #ccc; display: flex; justify-content: space-between; align-items: flex-start;">
    <div style="display: flex; flex-direction: column; gap: 1mm;">
      <span>Cliente: ${cotacao.cliente ?? "-"}</span>
      <span>Proposta: ${cotacao.num_cotacao ?? "-"} ${revisao}</span>
    </div>
    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1mm;">
      <span>Data: ${dataFormatada}</span>
      <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
  </div>
`,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="COT-${cotacao.num_cotacao}-${revisao}.pdf"`,
    });
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch all pedidos
app.get("/pedidos", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT pedidos.*, fornecedores.razao_social
    FROM pedidos
    JOIN fornecedores ON pedidos.fornecedor_id = fornecedores.id
    ORDER BY pedidos.created_at DESC
  `,
    )
    .all();
  res.json(rows);
});

// GET - fetch one pedido with its line items and status log
app.get("/pedidos/:id", (req, res) => {
  const pedido = db
    .prepare(`SELECT * FROM pedidos WHERE id = ?`)
    .get(req.params.id);

  if (!pedido) return res.status(404).json({ error: "Pedido não encontrado." });

  const itens = db
    .prepare(
      `
    SELECT * FROM pedido_itens WHERE pedido_id = ? ORDER BY item ASC
  `,
    )
    .all(req.params.id);

  const statusLog = db
    .prepare(
      `
    SELECT * FROM pedido_status_log WHERE pedido_id = ? ORDER BY alterado_em ASC
  `,
    )
    .all(req.params.id);

  res.json({ ...pedido, itens, statusLog });
});

// PUT - update existing pedido
app.put("/pedidos/:id", (req, res) => {
  const {
    num_pedido,
    data_pedido,
    fornecedor_id,
    prazo_entrega,
    num_proposta,
    cond_pagamento,
    observacoes,
    observacoes_tecnicas,
    aplicacao,
    endereco_entrega,
    comprador,
    comprador_email,
    comprador_telefone,
    itens,
  } = req.body;

  try {
    const current = db
      .prepare(`SELECT status FROM pedidos WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Pedido não encontrado." });

    if (["Faturado", "Cancelado"].includes(current.status)) {
      return res.status(403).json({
        error: "Este pedido não pode ser editado no status atual.",
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(
        `
        UPDATE pedidos SET
          num_pedido=?, data_pedido=?, fornecedor_id=?, prazo_entrega=?,
          num_proposta=?, cond_pagamento=?, observacoes=?, observacoes_tecnicas=?, aplicacao=?,
          endereco_entrega=?, comprador=?, comprador_email=?, comprador_telefone=?,
          updated_at=datetime('now')
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
        observacoes_tecnicas,
        aplicacao,
        endereco_entrega,
        comprador,
        comprador_email,
        comprador_telefone,
        req.params.id,
      );

      // replace line items
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

// PATCH - update pedido status
app.patch("/pedidos/:id/status", (req, res) => {
  const { status_novo, alterado_por, observacao } = req.body;

  try {
    const current = db
      .prepare(`SELECT status FROM pedidos WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Pedido não encontrado." });

    // define allowed transitions
    const transicoesPermitidas = {
      Criado: ["Em Produção", "Cancelado"],
      "Em Produção": ["Entregue", "Cancelado"],
      Entregue: ["Faturado", "Cancelado"],
      Faturado: [],
      Cancelado: [],
    };

    const permitidas = transicoesPermitidas[current.status] || [];

    if (!permitidas.includes(status_novo)) {
      return res.status(403).json({
        error: `Não é possível mudar o status de "${current.status}" para "${status_novo}".`,
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(
        `
        UPDATE pedidos SET status = ?, updated_at = datetime('now') WHERE id = ?
      `,
      ).run(status_novo, req.params.id);

      db.prepare(
        `
        INSERT INTO pedido_status_log (pedido_id, status_anterior, status_novo, alterado_por, observacao)
        VALUES (?, ?, ?, ?, ?)
      `,
      ).run(
        req.params.id,
        current.status,
        status_novo,
        alterado_por,
        observacao,
      );
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch attachments for a pedido
app.get("/pedidos/:id/anexos", (req, res) => {
  try {
    const anexos = db
      .prepare(
        `
      SELECT * FROM pedido_anexos WHERE pedido_id = ? ORDER BY uploaded_at ASC
    `,
      )
      .all(req.params.id);
    res.json(anexos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - create a new pedido
app.post("/pedidos", (req, res) => {
  const {
    num_pedido,
    data_pedido,
    fornecedor_id,
    prazo_entrega,
    num_proposta,
    cond_pagamento,
    observacoes,
    observacoes_tecnicas,
    aplicacao,
    endereco_entrega,
    comprador,
    comprador_email,
    comprador_telefone,
    alterado_por,
    itens,
  } = req.body;

  try {
    const transaction = db.transaction(() => {
      const result = db
        .prepare(
          `
        INSERT INTO pedidos (
          num_pedido, data_pedido, fornecedor_id, prazo_entrega,
          num_proposta, cond_pagamento, observacoes, observacoes_tecnicas, aplicacao,
          endereco_entrega, comprador, comprador_email, comprador_telefone,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criado')
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
          observacoes_tecnicas,
          aplicacao,
          endereco_entrega,
          comprador,
          comprador_email,
          comprador_telefone,
        );

      const pedidoId = result.lastInsertRowid;

      // insert line items
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

      // log initial status
      db.prepare(
        `
        INSERT INTO pedido_status_log (pedido_id, status_anterior, status_novo, alterado_por)
        VALUES (?, null, 'Criado', ?)
      `,
      ).run(pedidoId, alterado_por);

      return pedidoId;
    });

    const id = transaction();
    res.json({ success: true, id });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({ error: "Um pedido com este número já existe." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST - upload attachment for a pedido
app.post("/pedidos/:id/anexos", upload.single("arquivo"), (req, res) => {
  try {
    const pedido = db
      .prepare(`SELECT status FROM pedidos WHERE id = ?`)
      .get(req.params.id);

    if (!pedido)
      return res.status(404).json({ error: "Pedido não encontrado." });

    // only allow attachments when status is Em Produção or later
    const statusPermitidos = ["Em Produção", "Entregue", "Faturado"];
    if (!statusPermitidos.includes(pedido.status)) {
      // delete the uploaded file since we're rejecting it
      fsSync.unlinkSync(req.file.path);
      return res.status(403).json({
        error:
          "Anexos só podem ser adicionados a partir do status 'Em Produção'.",
      });
    }

    db.prepare(
      `
      INSERT INTO pedido_anexos (pedido_id, nome_original, nome_arquivo, caminho, tipo, tamanho)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      req.params.id,
      req.file.originalname,
      req.file.filename,
      req.file.path,
      req.file.mimetype,
      req.file.size,
    );

    res.json({ success: true, filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - download/view a specific attachment
app.get("/pedidos/anexos/:anexoId", (req, res) => {
  try {
    const anexo = db
      .prepare(`SELECT * FROM pedido_anexos WHERE id = ?`)
      .get(req.params.anexoId);

    if (!anexo) return res.status(404).json({ error: "Anexo não encontrado." });

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${anexo.nome_original}"`,
    );
    res.setHeader("Content-Type", anexo.tipo);
    res.sendFile(anexo.caminho);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - remove an attachment
app.delete("/pedidos/anexos/:anexoId", (req, res) => {
  try {
    const anexo = db
      .prepare(`SELECT * FROM pedido_anexos WHERE id = ?`)
      .get(req.params.anexoId);

    if (!anexo) return res.status(404).json({ error: "Anexo não encontrado." });

    // delete file from disk
    if (fsSync.existsSync(anexo.caminho)) {
      fsSync.unlinkSync(anexo.caminho);
    }

    db.prepare(`DELETE FROM pedido_anexos WHERE id = ?`).run(
      req.params.anexoId,
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - generate PDF for a pedido
app.get("/pedidos/:id/pdf", async (req, res) => {
  try {
    const pedido = db
      .prepare(
        `
      SELECT pedidos.*, fornecedores.razao_social, fornecedores.cnpj,
      fornecedores.ie, fornecedores.rua, fornecedores.bairro,
      fornecedores.cidade, fornecedores.estado
      FROM pedidos
      JOIN fornecedores ON pedidos.fornecedor_id = fornecedores.id
      WHERE pedidos.id = ?
    `,
      )
      .get(req.params.id);

    if (!pedido)
      return res.status(404).json({ error: "Pedido não encontrado." });

    const itens = db
      .prepare(
        `
      SELECT * FROM pedido_itens WHERE pedido_id = ? ORDER BY item ASC
    `,
      )
      .all(req.params.id);

    const dataFormatada = formatarData(pedido.data_pedido);

    // logo and fonts
    const logoPath = path.join(
      __dirname,
      "../frontend/assets/Imagens/logo-veikonv-vetorizado.png",
    );
    const logoBase64 = fs.readFileSync(logoPath).toString("base64");
    const logoSrc = `data:image/png;base64,${logoBase64}`;

    const fontRegular = fs
      .readFileSync(
        path.join(__dirname, "../frontend/assets/fonts/Inter_18pt-Regular.ttf"),
      )
      .toString("base64");
    const fontBold = fs
      .readFileSync(
        path.join(__dirname, "../frontend/assets/fonts/Inter_18pt-Bold.ttf"),
      )
      .toString("base64");
    const fontItalic = fs
      .readFileSync(
        path.join(__dirname, "../frontend/assets/fonts/Inter_18pt-Italic.ttf"),
      )
      .toString("base64");
    const fontBoldItalic = fs
      .readFileSync(
        path.join(
          __dirname,
          "../frontend/assets/fonts/Inter_18pt-BoldItalic.ttf",
        ),
      )
      .toString("base64");

    const itensHTML = itens
      .map(
        (item) => `
      <tr>
        <td>${item.item}</td>
        <td>${item.quantidade ?? ""}</td>
        <td>${item.descricao ?? ""}</td>
        <td>${item.unidade ?? ""}</td>
        <td>${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? ""}</td>
        <td>${item.ipi ?? "0"}%</td>
        <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? ""}</td>
      </tr>
    `,
      )
      .join("");

    const totalGeral = itens.reduce((sum, item) => sum + (item.total ?? 0), 0);

    const html = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <style>
          @font-face {
            font-family: 'Inter';
            src: url(data:font/truetype;base64,${fontRegular});
            font-weight: normal;
            font-style: normal;
          }
          @font-face {
            font-family: 'Inter';
            src: url(data:font/truetype;base64,${fontBold});
            font-weight: bold;
            font-style: normal;
          }
          @font-face {
            font-family: 'Inter';
            src: url(data:font/truetype;base64,${fontItalic});
            font-weight: normal;
            font-style: italic;
          }
          @font-face {
            font-family: 'Inter';
            src: url(data:font/truetype;base64,${fontBoldItalic});
            font-weight: bold;
            font-style: italic;
          }

          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', Arial, sans-serif; font-size: 10pt; color: #000; }

          h1 { font-size: 16pt; text-align: center; margin-bottom: 8mm; }
          h2 { font-size: 11pt; margin-top: 6mm; margin-bottom: 2mm; font-weight: bold; }
          hr { border: none; border-top: 1px solid #ccc; margin-bottom: 4mm; }

          .container-numdata { display: flex; gap: 10mm; margin-bottom: 6mm; }
          .column { flex: 1; }
          .column label { font-size: 8pt; font-weight: bold; display: block; }
          .column p { font-size: 10pt; }

          .two-col { display: flex; gap: 10mm; margin-bottom: 6mm; }
          .two-col .col { flex: 1; }
          .field { margin-bottom: 3mm; }
          .field label { font-size: 8pt; font-weight: bold; display: block; }
          .field p { font-size: 10pt; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 9pt; }
          th { background: #f0f0f0; padding: 2mm 3mm; text-align: left; border: 1px solid #ccc; font-size: 8pt; }
          td { padding: 2mm 3mm; border: 1px solid #ccc; }

          .total-geral { text-align: right; font-weight: bold; font-size: 11pt; margin-bottom: 6mm; }
          .observacoes { margin-bottom: 6mm; line-height: 1.5; }
          .responsavel { display: flex; gap: 10mm; margin-bottom: 6mm; }
          .responsavel .field { flex: 1; }
        </style>
      </head>
      <body>

        <h1>PEDIDO DE COMPRA</h1>

        <!-- IDENTIFICATION -->
        <div class="container-numdata">
          <div class="column">
            <label>NO. DO PEDIDO</label>
            <p>${pedido.num_pedido ?? "-"}</p>
          </div>
          <div class="column">
            <label>DATA</label>
            <p>${dataFormatada}</p>
          </div>
          <div class="column">
            <label>NO. DA PROPOSTA</label>
            <p>${pedido.num_proposta ?? "-"}</p>
          </div>
        </div>

        <!-- SUPPLIER AND COMMERCIAL CONDITIONS -->
        <div class="two-col">
          <div class="col">
            <h2>DADOS DO FORNECEDOR</h2>
            <hr>
            <div class="field"><label>FORNECEDOR</label><p>${pedido.razao_social ?? "-"}</p></div>
            <div class="two-col">
              <div class="field"><label>CNPJ</label><p>${pedido.cnpj ?? "-"}</p></div>
              <div class="field"><label>IE</label><p>${pedido.ie ?? "-"}</p></div>
            </div>
            <div class="field"><label>ENDEREÇO</label><p>${pedido.rua ?? "-"}</p></div>
            <div class="two-col">
              <div class="field"><label>BAIRRO</label><p>${pedido.bairro ?? "-"}</p></div>
              <div class="field"><label>CIDADE</label><p>${pedido.cidade ?? "-"}</p></div>
              <div class="field"><label>ESTADO</label><p>${pedido.estado ?? "-"}</p></div>
            </div>
          </div>
          <div class="col">
            <h2>CONDIÇÕES COMERCIAIS</h2>
            <hr>
            <div class="field"><label>PRAZO DE ENTREGA</label><p>${pedido.prazo_entrega ?? "-"}</p></div>
            <div class="field"><label>CONDIÇÃO DE PAGAMENTO</label><p>${pedido.cond_pagamento ?? "-"}</p></div>
            <div class="field"><label>APLICAÇÃO</label><p>${pedido.aplicacao ?? "-"}</p></div>
            <div class="field"><label>ENDEREÇO DE ENTREGA</label><p>${pedido.endereco_entrega ?? "-"}</p></div>
          </div>
        </div>

        <!-- ITEMS TABLE -->
        <h2>ITENS DO PEDIDO</h2>
        <hr>
        <table>
          <thead>
            <tr>
              <th>ITEM</th>
              <th>QTD</th>
              <th>DESCRIÇÃO</th>
              <th>UNID.</th>
              <th>VALOR UNIT.</th>
              <th>IPI (%)</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itensHTML}
          </tbody>
        </table>
        <div class="total-geral">
          TOTAL GERAL: ${totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>

        <!-- OBSERVAÇÕES -->
        <h2>OBSERVAÇÕES</h2>
        <hr>
        <div class="observacoes">
          <p>${pedido.observacoes ?? "-"}</p>
        </div>

        <!-- OBSERVAÇÕES TÉCNICAS -->
        <h2>OBSERVAÇÕES TÉCNICAS</h2>
        <hr>
        <div class="observacoes">
          <p>${pedido.observacoes_tecnicas ?? "-"}</p>
        </div>

        <!-- RESPONSÁVEL -->
        <h2>RESPONSÁVEL PELA COMPRA</h2>
        <hr>
        <div class="responsavel">
          <div class="field"><label>COMPRADOR</label><p>${pedido.comprador ?? "-"}</p></div>
          <div class="field"><label>EMAIL</label><p>${pedido.comprador_email ?? "-"}</p></div>
          <div class="field"><label>TELEFONE</label><p>${pedido.comprador_telefone ?? "-"}</p></div>
        </div>

      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "40mm", bottom: "20mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="width:100%; font-family: Arial, sans-serif; font-size: 9pt; padding: 3mm 10mm; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center;">
          <img src="${logoSrc}" style="height: 12mm;" />
          <div style="text-align: right; font-size: 8pt;">
            <strong>VEIKON EQUIPAMENTOS E SERVIÇOS LTDA</strong><br>
            CNPJ: 19.309.792/0001-09 / IE: 714.079.490.113<br>
            Rua Joana Fabri Thomé 442, Santa Claudina — Vinhedo - SP, CEP: 13284-432<br>
            Telefone: (19) 3846-6802 / Email: comercial@veikon.com.br
          </div>
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; font-family: Arial, sans-serif; font-size: 8pt; padding: 2mm 10mm; border-top: 1px solid #ccc; display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; flex-direction: column; gap: 1mm;">
            <span>Fornecedor: ${pedido.razao_social ?? "-"}</span>
            <span>Pedido: ${pedido.num_pedido ?? "-"}</span>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1mm;">
            <span>Data: ${dataFormatada}</span>
            <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
          </div>
        </div>
      `,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="PC-${pedido.num_pedido}.pdf"`,
    });
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
