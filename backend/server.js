// import express framework
const express = require("express");

/* // import puppeteer
const puppeteer = require("puppeteer"); */

const wkhtmltopdf = require("wkhtmltopdf");
wkhtmltopdf.command = "C:\\Program Files\\wkhtmltopdf\\bin\\wkhtmltopdf.exe";

// import database connection
const db = require("./db/db");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { default: puppeteer } = require("puppeteer");
const multer = require("multer");

// create an express app (your server)
const app = express();

// define port server will run on
const PORT = 3000;

// middleware - parse incoming JSON requests
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.redirect("/pages/erpIndex.html");
});

// Função para formatar a data em PT-BR
function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

// SUPPLIERS GET - fetch all active suppliers
app.get("/fornecedores", (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM fornecedores WHERE is_active = 1 ORDER BY razao_social ASC",
    )
    .all();
  res.json(rows);
});

// SUPPLIERS POST - register new supplier
app.post("/fornecedores", (req, res) => {
  const {
    razao_social,
    cnpj,
    ie,
    rua,
    bairro,
    cidade,
    estado,
    cep,
    telefone,
    contato,
    telefone_rep,
    email,
  } = req.body;
  try {
    db.prepare(
      `
  INSERT INTO fornecedores (razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone, contato, telefone_rep, email)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
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
      contato,
      telefone_rep,
      email,
    );
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed: fornecedores.cnpj")) {
      res.status(409).json({ error: "Um fornecedor com este CNPJ já existe." });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// SUPPLIERS PUT - update existing supplier
app.put("/fornecedores/:id", (req, res) => {
  const {
    razao_social,
    cnpj,
    ie,
    rua,
    bairro,
    cidade,
    estado,
    cep,
    telefone,
    contato,
    telefone_rep,
    email,
  } = req.body;

  db.prepare(
    `
  UPDATE fornecedores SET 
    razao_social=?, cnpj=?, ie=?, rua=?, bairro=?, cidade=?, estado=?, cep=?, 
    telefone=?, contato=?, telefone_rep=?, email=?
  WHERE id=?
`,
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
    contato,
    telefone_rep,
    email,
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
    ORDER BY CAST(c1.num_cotacao AS INTEGER) DESC, c1.num_cotacao DESC
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
    data_aceite,
    data_prevista,
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
    prazo_entrega, data_aceite, data_prevista, cond_pagamento, validade_proposta, moeda,
    condicoes_gerais, comprador, comprador_email, comprador_telefone,
    status, revisao
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criada', 0)
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
          data_aceite,
          data_prevista,
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
    data_aceite,
    data_prevista,
    cond_pagamento,
    validade_proposta,
    moeda,
    condicoes_gerais,
    comprador,
    comprador_email,
    comprador_telefone,
    alterado_por,
    observacao_status,
    itens,
  } = req.body;

  try {
    const current = db
      .prepare(`SELECT status FROM cotacoes WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Cotação não encontrada." });

    const statusBloqueados = ["Recusada", "Cancelada"];
    if (statusBloqueados.includes(current.status)) {
      return res.status(403).json({
        error: "Esta cotação está encerrada e não pode ser editada.",
      });
    }

    // validate status transition if status changed
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

    const statusNovo = req.body.status || current.status;
    const statusMudou = statusNovo !== current.status;

    if (statusMudou) {
      const permitidas = transicoesPermitidas[current.status] || [];
      if (!permitidas.includes(statusNovo)) {
        return res.status(403).json({
          error: `Não é possível mudar o status de "${current.status}" para "${statusNovo}".`,
        });
      }
      if (!alterado_por) {
        return res.status(400).json({
          error: "Por favor, informe quem está alterando o status.",
        });
      }
    }

    const transaction = db.transaction(() => {
      // determine which fields to update based on current status
      if (
        current.status === "Enviado ao Cliente" ||
        current.status === "Aceita" ||
        current.status === "Pausada"
      ) {
        // only update status and date fields
        db.prepare(
          `
          UPDATE cotacoes SET
            status=?, prazo_entrega=?, data_aceite=?, data_prevista=?,
            updated_at=datetime('now')
          WHERE id=?
        `,
        ).run(
          statusNovo,
          prazo_entrega,
          data_aceite,
          data_prevista,
          req.params.id,
        );
      } else {
        // full update
        db.prepare(
          `
          UPDATE cotacoes SET
            num_cotacao=?, data_cotacao=?, cliente=?, cliente_contato=?,
            cliente_email=?, objetivo=?, descricao_equipamentos=?,
            condicoes_proposta=?, observacoes=?, prazo_entrega=?,
            data_aceite=?, data_prevista=?, cond_pagamento=?,
            validade_proposta=?, moeda=?, condicoes_gerais=?,
            comprador=?, comprador_email=?, comprador_telefone=?,
            status=?, updated_at=datetime('now')
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
          data_aceite,
          data_prevista,
          cond_pagamento,
          validade_proposta,
          moeda,
          condicoes_gerais,
          comprador,
          comprador_email,
          comprador_telefone,
          statusNovo,
          req.params.id,
        );

        // replace line items only on full update
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
      }

      // log status change if status changed
      if (statusMudou) {
        db.prepare(
          `
          INSERT INTO cotacao_status_log 
            (cotacao_id, status_anterior, status_novo, alterado_por, observacao)
          VALUES (?, ?, ?, ?, ?)
        `,
        ).run(
          req.params.id,
          current.status,
          statusNovo,
          alterado_por,
          observacao_status || null,
        );
      }
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
    prazo_entrega, data_aceite, data_prevista, cond_pagamento, validade_proposta, moeda,
    condicoes_gerais, comprador, comprador_email, comprador_telefone,
    status, revisao
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criada', ?)
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
          current.data_aceite,
          current.data_prevista,
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

    const moeda = cotacao.moeda || "BRL";
    const totalGeral = itens.reduce((sum, item) => sum + (item.total ?? 0), 0);
    const totalGeralFormatado = totalGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: moeda,
    });

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
    <td>${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: moeda }) ?? ""}</td>
    <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: moeda }) ?? ""}</td>
  </tr>
`,
      )
      .join("");

    // full HTML document for wkhtmltopdf to render
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

  .field label { font-size: 8pt; font-weight: bold; display: block; margin-top: 3mm; }
  .field p { font-size: 10pt; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 9pt; }
  th { background: #f0f0f0; padding: 2mm 3mm; text-align: left; border: 1px solid #ccc; font-size: 8pt; }
  td { padding: 2mm 3mm; border: 1px solid #ccc; }

  .total-geral { text-align: right; font-weight: bold; font-size: 11pt; margin-bottom: 6mm; }
  .quill-content { margin-bottom: 6mm; line-height: 1.5; }
  .quill-content p { margin-bottom: 2mm; }
  .quill-content ul, .quill-content ol { padding-left: 5mm; margin-bottom: 2mm; }

</style>
      </head>
      <body>
        <h1>COTAÇÃO</h1>

<table style="width:100%; border-collapse: collapse; border: none; margin-bottom: 6mm; text-align: center;">
  <tr>
    <td style="width:33%; vertical-align: top; border: none; padding: 0 5mm 0 0; text-align: center;">
      <div style="font-size: 8pt; font-weight: bold;">NO. DA COTAÇÃO</div>
      <div>${cotacao.num_cotacao ?? "-"}</div>
    </td>
    <td style="width:33%; vertical-align: top; border: none; padding: 0 5mm 0 0; text-align: center;">
      <div style="font-size: 8pt; font-weight: bold;">DATA</div>
      <div>${dataFormatada}</div>
    </td>
    <td style="width:33%; vertical-align: top; border: none; padding: 0; text-align: center;">
      <div style="font-size: 8pt; font-weight: bold;">REVISÃO</div>
      <div>${revisao}</div>
    </td>
  </tr>
</table>


<table style="width:100%; border-collapse: collapse; margin-bottom: 6mm; border: none;">
  <tr>
    <td style="width:50%; padding-right: 5mm; vertical-align: top; border: none;">
      <h2>DADOS DO CLIENTE</h2>
      <hr>

      <table style="width:100%; border-collapse: collapse; margin-top: 3mm; border: none;">
      <tr>
          <td style="width:50%; vertical-align: top; padding-right: 3mm; border: none; padding-left: 0;">
          <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">CLIENTE</div>
      <div>${cotacao.cliente ?? "-"}</div>
          </td>
      </tr>  
      <tr>
          <td style="width:50%; vertical-align: top; padding-right: 3mm; border: none; padding-left: 0;">
            <div style="font-size: 8pt; font-weight: bold;">CONTATO</div>
            <div>${cotacao.cliente_contato ?? "-"}</div>
          </td>
          <td style="width:50%; vertical-align: top; border: none; padding-left: 0;">
            <div style="font-size: 8pt; font-weight: bold;">EMAIL</div>
            <div>${cotacao.cliente_email ?? "-"}</div>
          </td>
        </tr>
      </table>
    </td>
    <td style="width:50%; vertical-align: top; border: none;">
      <h2>CONDIÇÕES COMERCIAIS</h2>
      <hr>
      <table style="width:100%; border-collapse: collapse; border: none;">
        <tr>
          <td style="width:50%; vertical-align: top; padding-right: 3mm; border: none;">
            <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">PRAZO DE ENTREGA (dias após aceite)</div>
            <div>${cotacao.prazo_entrega ?? "-"}</div>
          </td>
          <td style="width:50%; vertical-align: top; border: none;">
            <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">VALIDADE DA PROPOSTA</div>
            <div>${cotacao.validade_proposta ?? "-"}</div>
          </td>
        </tr>
        <tr>
          <td style="width:50%; vertical-align: top; padding-right: 3mm; border: none;">
            <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">CONDIÇÃO DE PAGAMENTO</div>
            <div>${cotacao.cond_pagamento ?? "-"}</div>
          </td>
          <td style="width:50%; vertical-align: top; border: none;">
            <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">MOEDA</div>
            <div>${cotacao.moeda ?? "BRL"}</div>
          </td>
        </tr>
        <tr>
          <td style="width:50%; vertical-align: top; padding-right: 3mm; border: none;">
            <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">DATA DE ACEITE</div>
            <div>${formatarData(cotacao.data_aceite)}</div>
          </td>
          <td style="width:50%; vertical-align: top; border: none;">
            <div style="font-size: 8pt; font-weight: bold; margin-top: 3mm;">DATA PREVISTA DE ENTREGA</div>
            <div>${cotacao.data_prevista ?? "-"}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

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
<div class="total-geral">TOTAL GERAL: ${totalGeralFormatado}</div>

        <h2>CONDIÇÕES DA PROPOSTA</h2>
        <hr>
        <div class="quill-content">${cotacao.condicoes_proposta ?? ""}</div>

        <h2>RESPONSÁVEL PELA COTAÇÃO</h2>
<hr>
<table style="width:100%; border-collapse: collapse; border: none;">
  <tr>
    <td style="width:33%; padding-right: 5mm; vertical-align: top; border: none;">
      <div style="font-size: 8pt; font-weight: bold;">RESPONSÁVEL</div>
      <div>${cotacao.comprador ?? "-"}</div>
    </td>
    <td style="width:33%; padding-right: 5mm; vertical-align: top; border: none;">
      <div style="font-size: 8pt; font-weight: bold;">EMAIL</div>
      <div>${cotacao.comprador_email ?? "-"}</div>
    </td>
    <td style="width:33%; vertical-align: top; border: none;">
      <div style="font-size: 8pt; font-weight: bold;">TELEFONE</div>
      <div>${cotacao.comprador_telefone ?? "-"}</div>
    </td>
  </tr>
</table>

        <h2>CONDIÇÕES GERAIS DE VENDA</h2>
        <hr>
        <div class="quill-content">${cotacao.condicoes_gerais ?? ""}</div>

      </body>
      </html>
    `;

    // write temp header and footer file
    const headerPath = path.join(__dirname, "../frontend/temp-header.html");
    const footerPath = path.join(__dirname, "../frontend/temp-footer.html");
    const logoFilePath = `file:///${path.join(__dirname, "../frontend/assets/Imagens/logo-veikonv-vetorizado.png").replace(/\\/g, "/")}`;

    const headerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding: 0 10mm; font-family: Arial, sans-serif; font-size: 8pt;">
  <table style="width:100%; border-bottom: 1px solid #ccc; padding-bottom: 2mm;">
    <tr>
      <td style="text-align: left; vertical-align: middle; width: 30%;">
        <img src="${logoFilePath}" style="height: 14mm;" />
      </td>
      <td style="text-align: right; vertical-align: middle; font-size: 7pt;">
        <strong style="font-size: 9pt;">VEIKON EQUIPAMENTOS E SERVIÇOS LTDA</strong><br>
        CNPJ: 19.309.792/0001-09 | IE: 714.079.490.113<br>
        Rua Joana Fabri Thomé 442, Santa Claudina — Vinhedo - SP, CEP: 13284-432<br>
        Tel: (19) 3846-6802 | Email: comercial@veikon.com.br
      </td>
    </tr>
  </table>
</body></html>`;

    fs.writeFileSync(headerPath, headerHtml, "utf8");

    const footerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script>
function subst() {
  var vars = {};
  var query_strings_from_url = document.location.search.substring(1).split('&');
  for (var query_string in query_strings_from_url) {
    if (query_strings_from_url.hasOwnProperty(query_string)) {
      var temp_var = query_strings_from_url[query_string].split('=', 2);
      vars[temp_var[0]] = decodeURI(temp_var[1]);
    }
  }
  var css_selector_classes = ['page', 'topage'];
  for (var css_class in css_selector_classes) {
    if (css_selector_classes.hasOwnProperty(css_class)) {
      var element = document.getElementsByClassName(css_selector_classes[css_class]);
      for (var j = 0; j < element.length; ++j) {
        element[j].textContent = vars[css_selector_classes[css_class]];
      }
    }
  }
}
</script>
</head>
<body style="margin:0; padding: 0 10mm; font-family: Arial, sans-serif; font-size: 8pt;" onload="subst()">
  <table style="width:100%; border-top: 1px solid #ccc; padding-top: 2mm;">
    <tr>
      <td style="text-align: left; vertical-align: top;">
        <div>Cliente: ${cotacao.cliente ?? "-"}</div>
        <div>Proposta: ${cotacao.num_cotacao ?? "-"} ${revisao}</div>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div>Data: ${dataFormatada}</div>
        <div>Página <span class="page"></span> de <span class="topage"></span></div>
      </td>
    </tr>
  </table>
</body></html>`;

    fs.writeFileSync(headerPath, headerHtml, "utf8");
    fs.writeFileSync(footerPath, footerHtml, "utf8");

    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const stream = wkhtmltopdf(html, {
        pageSize: "A4",
        marginTop: "30mm",
        marginBottom: "20mm",
        marginLeft: "10mm",
        marginRight: "10mm",
        headerHtml: `file:///${headerPath.replace(/\\/g, "/")}`,
        footerHtml: `file:///${footerPath.replace(/\\/g, "/")}`,
        encoding: "UTF-8",
        enableJavascript: true,
        javascriptDelay: 300,
        enableLocalFileAccess: true,
        headerLine: false,
        headerSpacing: 3,
      });

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        try {
          fs.unlinkSync(headerPath);
        } catch (e) {}
        try {
          fs.unlinkSync(footerPath);
        } catch (e) {}
        resolve(Buffer.concat(chunks));
      });
      stream.on("error", (err) => {
        try {
          fs.unlinkSync(headerPath);
        } catch (e) {}
        try {
          fs.unlinkSync(footerPath);
        } catch (e) {}
        reject(err);
      });
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="COT-${cotacao.num_cotacao}-${revisao}.pdf"`,
    });

    res.send(pdfBuffer);
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
    ORDER BY CAST(pedidos.num_pedido AS INTEGER) DESC, pedidos.num_pedido DESC
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

// POST - clone an existing pedido
app.post("/pedidos/:id/clonar", (req, res) => {
  try {
    const pedido = db
      .prepare(`SELECT * FROM pedidos WHERE id = ?`)
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

    const transaction = db.transaction(() => {
      // insert cloned pedido with cleared num_pedido, today's date, and reset status
      const result = db
        .prepare(
          `
        INSERT INTO pedidos (
          num_pedido, data_pedido, fornecedor_id, prazo_entrega, data_prevista,
          num_proposta, cond_pagamento, observacoes, observacoes_tecnicas, aplicacao,
          endereco_entrega, comprador, comprador_email, comprador_telefone, status
        ) VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criado')
      `,
        )
        .run(
          "",
          pedido.fornecedor_id,
          pedido.prazo_entrega,
          pedido.data_prevista,
          pedido.num_proposta,
          pedido.cond_pagamento,
          pedido.observacoes,
          pedido.observacoes_tecnicas,
          pedido.aplicacao,
          pedido.endereco_entrega,
          pedido.comprador,
          pedido.comprador_email,
          pedido.comprador_telefone,
        );

      const novoPedidoId = result.lastInsertRowid;

      // copy all items
      for (const item of itens) {
        db.prepare(
          `
          INSERT INTO pedido_itens (pedido_id, item, quantidade, descricao, unidade, val_unitario, ipi, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          novoPedidoId,
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
        VALUES (?, null, 'Criado', 'Sistema - Clonagem')
      `,
      ).run(novoPedidoId);

      return novoPedidoId;
    });

    const novoPedidoId = transaction();
    res.json({ success: true, id: novoPedidoId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - update existing pedido
app.put("/pedidos/:id", (req, res) => {
  const {
    num_pedido,
    data_pedido,
    fornecedor_id,
    prazo_entrega,
    data_prevista,
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

    const transaction = db.transaction(() => {
      db.prepare(
        `
    UPDATE pedidos SET
      num_pedido=?, data_pedido=?, fornecedor_id=?, prazo_entrega=?, data_prevista=?,
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
        data_prevista,
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

      // get existing item IDs from database
      const existingIds = db
        .prepare(
          `
    SELECT id FROM pedido_itens WHERE pedido_id = ?
  `,
        )
        .all(req.params.id)
        .map((r) => r.id);

      // get incoming item IDs (null means new item)
      const incomingIds = itens.filter((i) => i.id).map((i) => i.id);

      // delete items that were removed by the user
      const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
      for (const id of toDelete) {
        db.prepare(`DELETE FROM pedido_itens WHERE id = ?`).run(id);
      }

      // update existing items or insert new ones
      for (const item of itens) {
        if (item.id) {
          // existing item — update in place
          db.prepare(
            `
    UPDATE pedido_itens SET
      item=?, quantidade=?, descricao=?, unidade=?, val_unitario=?, ipi=?, total=?, recebido=?
    WHERE id=?
  `,
          ).run(
            item.item,
            item.quantidade,
            item.descricao,
            item.unidade,
            item.val_unitario,
            item.ipi,
            item.total,
            item.recebido ? 1 : 0,
            item.id,
          );
        } else {
          // new item — insert
          db.prepare(
            `
    INSERT INTO pedido_itens (pedido_id, item, quantidade, descricao, unidade, val_unitario, ipi, total, recebido)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
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
      }
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - UPDATE PEDIDO STATUS
app.patch("/pedidos/:id/status", (req, res) => {
  const { status_novo, alterado_por, observacao } = req.body;

  try {
    const current = db
      .prepare(`SELECT status FROM pedidos WHERE id = ?`)
      .get(req.params.id);

    if (!current)
      return res.status(404).json({ error: "Pedido não encontrado." });

    const transicoesPermitidas = {
      Criado: ["Recebido", "Recebido Parcialmente", "Cancelado"],
      "Recebido Parcialmente": ["Recebido", "Cancelado"],
      Recebido: [],
      Cancelado: [],
    };

    const permitidas = transicoesPermitidas[current.status] || [];
    if (!permitidas.includes(status_novo)) {
      return res.status(400).json({
        error: `Não é possível mudar o status de "${current.status}" para "${status_novo}".`,
      });
    }

    db.prepare(`UPDATE pedidos SET status = ? WHERE id = ?`).run(
      status_novo,
      req.params.id,
    );

    res.json({ success: true });
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
    data_prevista,
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
    num_pedido, data_pedido, fornecedor_id, prazo_entrega, data_prevista,
    num_proposta, cond_pagamento, observacoes, observacoes_tecnicas, aplicacao,
    endereco_entrega, comprador, comprador_email, comprador_telefone, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Criado')
`,
        )
        .run(
          num_pedido,
          data_pedido,
          fornecedor_id,
          prazo_entrega,
          data_prevista,
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

// GET - fetch all notas fiscais for a pedido, with their linked items
app.get("/pedidos/:id/nf", (req, res) => {
  try {
    const nfs = db
      .prepare(
        `
      SELECT * FROM pedido_notas_fiscais WHERE pedido_id = ? ORDER BY created_at ASC
    `,
      )
      .all(req.params.id);

    // for each NF, fetch the linked item ids
    const result = nfs.map((nf) => {
      const itens = db
        .prepare(
          `
        SELECT pedido_item_id FROM nf_itens WHERE nf_id = ?
      `,
        )
        .all(nf.id);
      return {
        ...nf,
        itens: itens.map((i) => i.pedido_item_id),
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - add a new nota fiscal linked to specific items
app.post("/pedidos/:id/nf", (req, res) => {
  const { numero_nf, item_ids } = req.body;
  if (!numero_nf)
    return res.status(400).json({ error: "Número da NF é obrigatório." });
  if (!item_ids || item_ids.length === 0)
    return res.status(400).json({ error: "Selecione pelo menos um item." });

  try {
    const transaction = db.transaction(() => {
      // insert the NF
      const result = db
        .prepare(
          `
        INSERT INTO pedido_notas_fiscais (pedido_id, numero_nf)
        VALUES (?, ?)
      `,
        )
        .run(req.params.id, numero_nf);

      const nfId = result.lastInsertRowid;

      // link each selected item to this NF
      for (const itemId of item_ids) {
        db.prepare(
          `
          INSERT INTO nf_itens (nf_id, pedido_item_id) VALUES (?, ?)
        `,
        ).run(nfId, itemId);
      }

      return nfId;
    });

    const nfId = transaction();
    res.json({ success: true, id: nfId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - remove a nota fiscal and its item links
app.delete("/pedidos/nf/:nfId", (req, res) => {
  try {
    const nf = db
      .prepare(`SELECT * FROM pedido_notas_fiscais WHERE id = ?`)
      .get(req.params.nfId);

    if (!nf)
      return res.status(404).json({ error: "Nota fiscal não encontrada." });

    // nf_itens will be deleted automatically via CASCADE
    db.prepare(`DELETE FROM pedido_notas_fiscais WHERE id = ?`).run(
      req.params.nfId,
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
    const moeda = "BRL";

    const itensHTML = itens
      .map(
        (item) => `
      <tr>
        <td>${item.item}</td>
        <td>${item.quantidade ?? ""}</td>
        <td>${item.descricao ?? ""}</td>
        <td>${item.unidade ?? ""}</td>
        <td>${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: moeda }) ?? ""}</td>
        <td>${item.ipi ?? "0"}%</td>
        <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: moeda }) ?? ""}</td>
      </tr>
    `,
      )
      .join("");

    const totalGeral = itens.reduce((sum, item) => sum + (item.total ?? 0), 0);
    const totalGeralFormatado = totalGeral.toLocaleString("pt-BR", {
      style: "currency",
      currency: moeda,
    });

    const html = `
      <!DOCTYPE html>
      <html lang="pt">
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; }
          h1 { font-size: 16pt; text-align: center; margin-bottom: 8mm; }
          h2 { font-size: 11pt; margin-top: 6mm; margin-bottom: 2mm; font-weight: bold; }
          hr { border: none; border-top: 1px solid #ccc; margin-bottom: 4mm; }
          b, strong, th, label { letter-spacing: 0.5px; }
          .field { margin-bottom: 3mm; }
          .field label { font-size: 8pt; font-weight: bold; display: block; }
          .field p { font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 9pt; }
          th { background: #f0f0f0; padding: 2mm 3mm; text-align: left; border: 1px solid #ccc; font-size: 8pt; }
          td { padding: 2mm 3mm; border: 1px solid #ccc; }
          .total-geral { text-align: right; font-weight: bold; font-size: 11pt; margin-bottom: 6mm; }
          .observacoes { margin-bottom: 6mm; line-height: 1.5; }
        </style>
      </head>
      <body>

        <h1>PEDIDO DE COMPRA</h1>

        <!-- IDENTIFICATION -->
        <table style="width:100%; border-collapse: collapse; border: none; margin-bottom: 6mm; text-align: center;">
          <tr>
            <td style="width:33%; vertical-align: top; border: none; padding: 0 5mm 0 0; text-align: center;">
              <div style="font-size: 8pt; font-weight: bold;">NO. DO PEDIDO</div>
              <div>${pedido.num_pedido ?? "-"}</div>
            </td>
            <td style="width:33%; vertical-align: top; border: none; padding: 0 5mm 0 0; text-align: center;">
              <div style="font-size: 8pt; font-weight: bold;">DATA</div>
              <div>${dataFormatada}</div>
            </td>
            <td style="width:33%; vertical-align: top; border: none; padding: 0; text-align: center;">
              <div style="font-size: 8pt; font-weight: bold;">NO. DA PROPOSTA</div>
              <div>${pedido.num_proposta ?? "-"}</div>
            </td>
          </tr>
        </table>

        <!-- SUPPLIER AND COMMERCIAL CONDITIONS -->
        <table style="width:100%; border-collapse: collapse; border: none; margin-bottom: 6mm;">
          <tr>
            <td style="width:50%; padding-right: 5mm; vertical-align: top; border: none;">
              <h2>DADOS DO FORNECEDOR</h2>
              <hr>
              <div class="field"><label>FORNECEDOR</label><p>${pedido.razao_social ?? "-"}</p></div>
              <table style="width:100%; border-collapse: collapse; margin-top: 3mm; padding: 0;">
                <tr>
                  <td style="width:50%; vertical-align: top; border: none; padding: 0 3mm 0 0;">
                    <div style="font-size: 8pt; font-weight: bold;">CNPJ</div>
                    <div>${pedido.cnpj ?? "-"}</div>
                  </td>
                  <td style="width:50%; vertical-align: top; border: none; padding: 0;">
                    <div style="font-size: 8pt; font-weight: bold;">IE</div>
                    <div>${pedido.ie ?? "-"}</div>
                  </td>
                </tr>
              </table>
              <div class="field" style="margin-top: 3mm;"><label>ENDEREÇO</label><p>${pedido.rua ?? "-"}</p></div>
              <table style="width:100%; border-collapse: collapse; margin-top: 3mm; padding: 0;">
                <tr>
                  <td style="width:33%; vertical-align: top; border: none; padding: 0 3mm 0 0;">
                    <div style="font-size: 8pt; font-weight: bold;">BAIRRO</div>
                    <div>${pedido.bairro ?? "-"}</div>
                  </td>
                  <td style="width:33%; vertical-align: top; border: none; padding: 0 3mm 0 0;">
                    <div style="font-size: 8pt; font-weight: bold;">CIDADE</div>
                    <div>${pedido.cidade ?? "-"}</div>
                  </td>
                  <td style="width:33%; vertical-align: top; border: none; padding: 0;">
                    <div style="font-size: 8pt; font-weight: bold;">ESTADO</div>
                    <div>${pedido.estado ?? "-"}</div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="width:50%; vertical-align: top; border: none;">
              <h2>CONDIÇÕES COMERCIAIS</h2>
              <hr>
              <div class="field"><label>PRAZO DE ENTREGA (Dias)</label><p>${pedido.prazo_entrega ?? "-"}</p></div>
              <div class="field"><label>CONDIÇÃO DE PAGAMENTO</label><p>${pedido.cond_pagamento ?? "-"}</p></div>
<div class="field"><label>DATA PREVISTA DE ENTREGA</label><p>${pedido.data_prevista ?? "-"}</p></div>
<div class="field"><label>ENDEREÇO DE ENTREGA</label><p>${pedido.endereco_entrega ?? "-"}</p></div>
            </td>
          </tr>
        </table>

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
        <div class="total-geral">TOTAL GERAL: ${totalGeralFormatado}</div>

        <!-- OBSERVAÇÕES -->
        <h2>OBSERVAÇÕES</h2>
        <hr>
        <div class="observacoes"><p>${pedido.observacoes ?? "-"}</p></div>

        <!-- OBSERVAÇÕES TÉCNICAS -->
        <h2>OBSERVAÇÕES TÉCNICAS</h2>
        <hr>
        <div class="observacoes"><p>${pedido.observacoes_tecnicas ?? "-"}</p></div>

        <!-- APLICAÇÃO -->
<h2>APLICAÇÃO</h2>
<hr>
<div class="observacoes"><p>${pedido.aplicacao ?? "-"}</p></div>

        <!-- RESPONSÁVEL -->
        <h2>RESPONSÁVEL PELA COMPRA</h2>
        <hr>
        <table style="width:100%; border-collapse: collapse; border: none;">
          <tr>
            <td style="width:33%; vertical-align: top; border: none; padding: 0 5mm 0 0;">
              <div style="font-size: 8pt; font-weight: bold;">COMPRADOR</div>
              <div>${pedido.comprador ?? "-"}</div>
            </td>
            <td style="width:33%; vertical-align: top; border: none; padding: 0 5mm 0 0;">
              <div style="font-size: 8pt; font-weight: bold;">EMAIL</div>
              <div>${pedido.comprador_email ?? "-"}</div>
            </td>
            <td style="width:33%; vertical-align: top; border: none; padding: 0;">
              <div style="font-size: 8pt; font-weight: bold;">TELEFONE</div>
              <div>${pedido.comprador_telefone ?? "-"}</div>
            </td>
          </tr>
        </table>

      </body>
      </html>
    `;

    // write temp header and footer files
    const headerPath = path.join(__dirname, "../frontend/temp-header.html");
    const footerPath = path.join(__dirname, "../frontend/temp-footer.html");
    const logoFilePath = `file:///${path.join(__dirname, "../frontend/assets/Imagens/logo-veikonv-vetorizado.png").replace(/\\/g, "/")}`;

    const headerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding: 0 10mm; font-family: Arial, sans-serif; font-size: 8pt;">
  <table style="width:100%; border-bottom: 1px solid #ccc; padding-bottom: 2mm;">
    <tr>
      <td style="text-align: left; vertical-align: middle; width: 30%;">
        <img src="${logoFilePath}" style="height: 14mm;" />
      </td>
      <td style="text-align: right; vertical-align: middle; font-size: 7pt;">
        <strong style="font-size: 9pt;">VEIKON EQUIPAMENTOS E SERVIÇOS LTDA</strong><br>
        CNPJ: 19.309.792/0001-09 | IE: 714.079.490.113<br>
        Rua Joana Fabri Thomé 442, Santa Claudina — Vinhedo - SP, CEP: 13284-432<br>
        Tel: (19) 3846-6802 | Email: comercial@veikon.com.br
      </td>
    </tr>
  </table>
</body></html>`;

    const footerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script>
function subst() {
  var vars = {};
  var query_strings_from_url = document.location.search.substring(1).split('&');
  for (var query_string in query_strings_from_url) {
    if (query_strings_from_url.hasOwnProperty(query_string)) {
      var temp_var = query_strings_from_url[query_string].split('=', 2);
      vars[temp_var[0]] = decodeURI(temp_var[1]);
    }
  }
  var css_selector_classes = ['page', 'topage'];
  for (var css_class in css_selector_classes) {
    if (css_selector_classes.hasOwnProperty(css_class)) {
      var element = document.getElementsByClassName(css_selector_classes[css_class]);
      for (var j = 0; j < element.length; ++j) {
        element[j].textContent = vars[css_selector_classes[css_class]];
      }
    }
  }
}
</script>
</head>
<body style="margin:0; padding: 0 10mm; font-family: Arial, sans-serif; font-size: 8pt;" onload="subst()">
  <table style="width:100%; border-top: 1px solid #ccc; padding-top: 2mm;">
    <tr>
      <td style="text-align: left; vertical-align: top;">
        <div>Fornecedor: ${pedido.razao_social ?? "-"}</div>
        <div>Pedido: ${pedido.num_pedido ?? "-"}</div>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div>Data: ${dataFormatada}</div>
        <div>Página <span class="page"></span> de <span class="topage"></span></div>
      </td>
    </tr>
  </table>
</body></html>`;

    fs.writeFileSync(headerPath, headerHtml, "utf8");
    fs.writeFileSync(footerPath, footerHtml, "utf8");

    const pdfBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const stream = wkhtmltopdf(html, {
        pageSize: "A4",
        marginTop: "30mm",
        marginBottom: "20mm",
        marginLeft: "10mm",
        marginRight: "10mm",
        headerHtml: `file:///${headerPath.replace(/\\/g, "/")}`,
        footerHtml: `file:///${footerPath.replace(/\\/g, "/")}`,
        encoding: "UTF-8",
        enableJavascript: true,
        javascriptDelay: 300,
        enableLocalFileAccess: true,
        headerLine: false,
        headerSpacing: 3,
      });

      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        try {
          fs.unlinkSync(headerPath);
        } catch (e) {}
        try {
          fs.unlinkSync(footerPath);
        } catch (e) {}
        resolve(Buffer.concat(chunks));
      });
      stream.on("error", (err) => {
        try {
          fs.unlinkSync(headerPath);
        } catch (e) {}
        try {
          fs.unlinkSync(footerPath);
        } catch (e) {}
        reject(err);
      });
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="PC-${pedido.num_pedido}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// MULTER STORAGE CONFIGURATION FOR PEDIDOS
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../frontend/uploads/pedidos"));
  },
  filename: (req, file, cb) => {
    const numPedido = req.params.numPedido.replace(/[^a-zA-Z0-9-_]/g, "_");

    // separate name from extension
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_.]/g, "_");

    // Brazilian date format DDMMYYYY
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, "0");
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const ano = now.getFullYear();
    const dataFormatada = `${dia}${mes}${ano}`;

    cb(null, `${numPedido}_${nameWithoutExt}_${dataFormatada}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
});

// POST - upload files to a pedido
app.post(
  "/pedidos/:numPedido/arquivos",
  upload.array("arquivos", 10),
  (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }
      const arquivos = req.files.map((f) => ({
        nome: f.originalname,
        arquivo: f.filename,
        tamanho: f.size,
      }));
      res.json({ success: true, arquivos });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET - list files for a pedido
app.get("/pedidos/:numPedido/arquivos", (req, res) => {
  try {
    const numPedido = req.params.numPedido.replace(/[^a-zA-Z0-9-_]/g, "_");
    const uploadsDir = path.join(__dirname, "../frontend/uploads/pedidos");
    const allFiles = fs.readdirSync(uploadsDir);
    // filter files that belong to this pedido
    const arquivos = allFiles
      .filter((f) => f.startsWith(numPedido + "_"))
      .map((f) => ({
        nome: f
          .replace(new RegExp(`^${numPedido}_`), "")
          .replace(/_\d{8}(\.[^.]+)$/, "$1"),
        arquivo: f,
        url: `/uploads/pedidos/${f}`,
      }));
    res.json(arquivos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - delete a file from a pedido
app.delete("/pedidos/:numPedido/arquivos/:filename", (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      "../frontend/uploads/pedidos",
      req.params.filename,
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Arquivo não encontrado." });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// serve uploaded files statically
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../frontend/uploads")),
);

// GET - FETCH ALL REGISTERED/ACTIVE USERS FROM DB
app.get("/usuarios", (req, res) => {
  const rows = db.prepare(`SELECT * FROM usuarios WHERE is_active = 1`).all();
  res.json(rows);
});

// ─── MÓDULO FINANCEIRO — NOTAS FISCAIS ───

// GET - fetch all notas fiscais for gerenciar NFs page
app.get("/notas-fiscais", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
  SELECT
    nf.id,
    nf.nNF,
    nf.dhEmi,
    nf.xNome,
    nf.tipo,
    nf.direcao,
    nf.status_pagamento,
    nf.created_at,
    p.num_pedido,
    p.aplicacao,
    COALESCE((SELECT SUM(i.vProd) FROM nf_itens_fiscal i WHERE i.nf_id = nf.id), 0) as valor_nf,
    (SELECT MIN(d.dVenc) FROM nf_duplicatas d WHERE d.nf_id = nf.id) as proxima_duplicata
  FROM notas_fiscais nf
  LEFT JOIN pedidos p ON nf.pedido_id = p.id
  ORDER BY nf.created_at DESC
`,
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch one nota fiscal with its items and duplicatas
app.get("/notas-fiscais/:id", (req, res) => {
  try {
    const nf = db
      .prepare(
        `
      SELECT 
        nf.*,
        p.num_pedido,
        p.aplicacao,
        p.data_prevista,
        f.razao_social
      FROM notas_fiscais nf
      LEFT JOIN pedidos p ON nf.pedido_id = p.id
      LEFT JOIN fornecedores f ON nf.fornecedor_id = f.id
      WHERE nf.id = ?
    `,
      )
      .get(req.params.id);

    if (!nf)
      return res.status(404).json({ error: "Nota fiscal não encontrada." });

    const itens = db
      .prepare(
        `
      SELECT * FROM nf_itens_fiscal WHERE nf_id = ? ORDER BY id ASC
    `,
      )
      .all(req.params.id);

    const duplicatas = db
      .prepare(
        `
      SELECT * FROM nf_duplicatas WHERE nf_id = ? ORDER BY dVenc ASC
    `,
      )
      .all(req.params.id);

    res.json({ ...nf, itens, duplicatas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - create a new nota fiscal with items and duplicatas
app.post("/notas-fiscais", (req, res) => {
  const {
    pedido_ids,
    fornecedor_id,
    cotacao_id,
    nNF,
    dhEmi,
    xNome,
    tipo,
    direcao,
    itens,
    duplicatas,
  } = req.body;

  if (!nNF)
    return res.status(400).json({ error: "Número da NF é obrigatório." });

  try {
    const transaction = db.transaction(() => {
      const result = db
        .prepare(
          `
  INSERT INTO notas_fiscais (pedido_id, fornecedor_id, cotacao_id, nNF, dhEmi, xNome, tipo, direcao)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`,
        )
        .run(
          pedido_ids?.[0] || null, // keep first pedido_id for backward compatibility
          fornecedor_id || null,
          cotacao_id || null,
          nNF,
          dhEmi,
          xNome,
          tipo || null,
          direcao || "Entrada",
        );

      const nfId = result.lastInsertRowid;

      // insert into junction table for each pedido
      for (const pedido_id of pedido_ids || []) {
        db.prepare(
          `
          INSERT OR IGNORE INTO nf_pedidos (nf_id, pedido_id) VALUES (?, ?)
        `,
        ).run(nfId, pedido_id);
      }

      // insert items
      for (const item of itens || []) {
        db.prepare(
          `
          INSERT INTO nf_itens_fiscal (
            nf_id, pedido_item_id, cProd, xProd, NCM, uCom, qCom, vUnCom, vProd,
            uTrib, qTrib, vUnTrib, nItemPed,
            icms_vBC, icms_pICMS, icms_vICMS,
            ipi_vBC, ipi_pIPI, ipi_vIPI,
            pis_vBC, pis_pPIS, pis_vPIS,
            cofins_vBC, cofins_pCOFINS, cofins_vCOFINS,
            total_impostos
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          nfId,
          item.pedido_item_id || null,
          item.cProd,
          item.xProd,
          item.NCM,
          item.uCom,
          item.qCom,
          item.vUnCom,
          item.vProd,
          item.uTrib,
          item.qTrib,
          item.vUnTrib,
          item.nItemPed,
          item.icms_vBC,
          item.icms_pICMS,
          item.icms_vICMS,
          item.ipi_vBC,
          item.ipi_pIPI,
          item.ipi_vIPI,
          item.pis_vBC,
          item.pis_pPIS,
          item.pis_vPIS,
          item.cofins_vBC,
          item.cofins_pCOFINS,
          item.cofins_vCOFINS,
          item.total_impostos || 0,
        );
      }

      // insert duplicatas
      for (const dup of duplicatas || []) {
        db.prepare(
          `
          INSERT INTO nf_duplicatas (nf_id, nDup, dVenc, vDup)
          VALUES (?, ?, ?, ?)
        `,
        ).run(nfId, dup.nDup, dup.dVenc, dup.vDup);
      }

      return nfId;
    });

    const nfId = transaction();
    res.json({ success: true, id: nfId });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({
        error: "Esta nota fiscal já foi cadastrada para este fornecedor.",
      });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// PATCH - update payment status of a duplicata
app.patch("/notas-fiscais/duplicatas/:id/status", (req, res) => {
  const { status, data_pagamento } = req.body;
  try {
    db.prepare(
      `
      UPDATE nf_duplicatas SET status = ?, data_pagamento = ? WHERE id = ?
    `,
    ).run(status, data_pagamento || null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - remove a nota fiscal
app.delete("/notas-fiscais/:id", (req, res) => {
  try {
    const nf = db
      .prepare(`SELECT * FROM notas_fiscais WHERE id = ?`)
      .get(req.params.id);
    if (!nf)
      return res.status(404).json({ error: "Nota fiscal não encontrada." });
    // itens and duplicatas deleted via CASCADE
    db.prepare(`DELETE FROM notas_fiscais WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch notas fiscais linked to a pedido (from new notas_fiscais table)
app.get("/pedidos/:id/notas-fiscais", (req, res) => {
  try {
    const nfs = db
      .prepare(
        `
      SELECT
        nf.id, nf.nNF, nf.xNome, nf.tipo, nf.status_pagamento,
        COALESCE((SELECT SUM(i.vProd) FROM nf_itens_fiscal i WHERE i.nf_id = nf.id), 0) as valor_total
      FROM notas_fiscais nf
      INNER JOIN nf_pedidos np ON np.nf_id = nf.id
      WHERE np.pedido_id = ?
      ORDER BY nf.created_at ASC
    `,
      )
      .all(req.params.id);

    res.json(nfs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - controle de custos (one row per NF linked to a pedido)
app.get("/controle-custos", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
  SELECT
    p.id as pedido_id,
    p.num_pedido,
    p.aplicacao,
    p.data_prevista,
    p.data_pedido,
    p.status as status_pedido,
    nf.id as nf_id,
    nf.nNF,
    nf.xNome,
    nf.tipo,
    nf.status_pagamento,
    nf.dhEmi,
    COALESCE((SELECT SUM(i.vProd) FROM nf_itens_fiscal i WHERE i.nf_id = nf.id), 0) as valor_nf
  FROM pedidos p
  LEFT JOIN nf_pedidos np ON np.pedido_id = p.id
  LEFT JOIN notas_fiscais nf ON nf.id = np.nf_id
  GROUP BY p.id, nf.id
  ORDER BY CAST(p.num_pedido AS INTEGER) DESC, p.num_pedido DESC
`,
      )
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch one NF for editing
app.get("/notas-fiscais/:id", (req, res) => {
  try {
    const nf = db
      .prepare(
        `
  SELECT nf.* FROM notas_fiscais nf WHERE nf.id = ?
`,
      )
      .get(req.params.id);

    if (!nf)
      return res.status(404).json({ error: "Nota fiscal não encontrada." });

    const itens = db
      .prepare(
        `
  SELECT * FROM nf_itens_fiscal WHERE nf_id = ? ORDER BY id ASC
`,
      )
      .all(req.params.id);

    const duplicatas = db
      .prepare(
        `
  SELECT * FROM nf_duplicatas WHERE nf_id = ? ORDER BY dVenc ASC
`,
      )
      .all(req.params.id);

    // get linked pedidos
    const pedidosVinculados = db
      .prepare(
        `
  SELECT p.id, p.num_pedido, p.aplicacao, f.razao_social
  FROM nf_pedidos np
  JOIN pedidos p ON p.id = np.pedido_id
  LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
  WHERE np.nf_id = ?
`,
      )
      .all(req.params.id);

    res.json({ ...nf, itens, duplicatas, pedidosVinculados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - update a nota fiscal (tipo, pedido_id, status_pagamento)
app.put("/notas-fiscais/:id", (req, res) => {
  const { tipo, pedido_ids, status_pagamento, direcao } = req.body;
  try {
    const transaction = db.transaction(() => {
      // get fornecedor_id from first pedido
      let fornecedor_id = null;
      if (pedido_ids && pedido_ids.length > 0) {
        const pedido = db
          .prepare(`SELECT fornecedor_id FROM pedidos WHERE id = ?`)
          .get(pedido_ids[0]);
        fornecedor_id = pedido?.fornecedor_id || null;
      }

      db.prepare(
        `
  UPDATE notas_fiscais SET
    tipo = ?,
    pedido_id = ?,
    fornecedor_id = ?,
    status_pagamento = ?,
    direcao = ?
  WHERE id = ?
`,
      ).run(
        tipo,
        pedido_ids?.[0] || null,
        fornecedor_id,
        status_pagamento,
        direcao || "Entrada",
        req.params.id,
      );

      // update junction table
      db.prepare(`DELETE FROM nf_pedidos WHERE nf_id = ?`).run(req.params.id);
      for (const pedido_id of pedido_ids || []) {
        db.prepare(
          `
          INSERT OR IGNORE INTO nf_pedidos (nf_id, pedido_id) VALUES (?, ?)
        `,
        ).run(req.params.id, pedido_id);
      }
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - delete a nota fiscal
app.delete("/notas-fiscais/:id", (req, res) => {
  try {
    const nf = db
      .prepare(`SELECT * FROM notas_fiscais WHERE id = ?`)
      .get(req.params.id);
    if (!nf)
      return res.status(404).json({ error: "Nota fiscal não encontrada." });
    db.prepare(`DELETE FROM notas_fiscais WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - fetch duplicatas by month for calendar
app.get("/duplicatas/calendario/:ano/:mes", (req, res) => {
  try {
    const { ano, mes } = req.params;
    const mesFormatado = mes.padStart(2, "0");
    const rows = db
      .prepare(
        `
      SELECT
        d.id,
        d.nf_id,
        d.nDup,
        d.dVenc,
        d.vDup,
        d.status,
        d.data_pagamento,
        nf.nNF,
        nf.xNome,
        nf.tipo,
        nf.direcao
      FROM nf_duplicatas d
      JOIN notas_fiscais nf ON nf.id = d.nf_id
      WHERE strftime('%Y', d.dVenc) = ? 
        AND strftime('%m', d.dVenc) = ?
      ORDER BY d.dVenc ASC
    `,
      )
      .all(ano, mesFormatado);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - mark duplicata as Paga and recalculate NF status
app.patch("/duplicatas/:id/status", (req, res) => {
  const { status, data_pagamento } = req.body;
  try {
    const transaction = db.transaction(() => {
      // update duplicata status
      db.prepare(
        `
        UPDATE nf_duplicatas SET 
          status = ?,
          data_pagamento = ?
        WHERE id = ?
      `,
      ).run(status, data_pagamento || null, req.params.id);

      // get nf_id for this duplicata
      const dup = db
        .prepare(`SELECT nf_id FROM nf_duplicatas WHERE id = ?`)
        .get(req.params.id);

      if (dup) {
        // check if all duplicatas for this NF are Paga
        const total = db
          .prepare(
            `
          SELECT COUNT(*) as count FROM nf_duplicatas WHERE nf_id = ?
        `,
          )
          .get(dup.nf_id);

        const pagas = db
          .prepare(
            `
          SELECT COUNT(*) as count FROM nf_duplicatas 
          WHERE nf_id = ? AND status = 'Paga'
        `,
          )
          .get(dup.nf_id);

        // auto-update NF status
        const nfStatus = total.count === pagas.count ? "Paga" : "Aberta";
        db.prepare(
          `
          UPDATE notas_fiscais SET status_pagamento = ? WHERE id = ?
        `,
        ).run(nfStatus, dup.nf_id);
      }
    });

    transaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - add manual duplicata to a nota fiscal
app.post("/notas-fiscais/:id/duplicatas", (req, res) => {
  const { nDup, dVenc, vDup } = req.body;
  if (!dVenc)
    return res.status(400).json({ error: "Data de vencimento é obrigatória." });

  try {
    db.prepare(
      `
      INSERT INTO nf_duplicatas (nf_id, nDup, dVenc, vDup, status, manual)
      VALUES (?, ?, ?, ?, 'Aberta', 1)
    `,
    ).run(req.params.id, nDup || "001", dVenc, vDup || 0);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - remove a manual duplicata
app.delete("/duplicatas/:id", (req, res) => {
  try {
    const dup = db
      .prepare(`SELECT nf_id, manual FROM nf_duplicatas WHERE id = ?`)
      .get(req.params.id);

    if (!dup)
      return res.status(404).json({ error: "Duplicata não encontrada." });

    db.prepare(`DELETE FROM nf_duplicatas WHERE id = ?`).run(req.params.id);

    // recalculate NF status after deletion
    const total = db
      .prepare(
        `
      SELECT COUNT(*) as count FROM nf_duplicatas WHERE nf_id = ?
    `,
      )
      .get(dup.nf_id);

    let nfStatus = "Aberta";
    if (total.count > 0) {
      const pagas = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM nf_duplicatas 
        WHERE nf_id = ? AND status = 'Paga'
      `,
        )
        .get(dup.nf_id);
      nfStatus = total.count === pagas.count ? "Paga" : "Aberta";
    }

    db.prepare(
      `
      UPDATE notas_fiscais SET status_pagamento = ? WHERE id = ?
    `,
    ).run(nfStatus, dup.nf_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - update a duplicata
app.put("/duplicatas/:id", (req, res) => {
  const { nDup, dVenc, vDup } = req.body;
  if (!dVenc)
    return res.status(400).json({ error: "Data de vencimento é obrigatória." });

  try {
    db.prepare(
      `
      UPDATE nf_duplicatas SET
        nDup = ?,
        dVenc = ?,
        vDup = ?
      WHERE id = ?
    `,
    ).run(nDup, dVenc, vDup, req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - create manual lancamento (no XML)
app.post("/notas-fiscais/manual", (req, res) => {
  const { xNome, tipo, valor, dVenc, dhEmi } = req.body;

  if (!xNome)
    return res.status(400).json({ error: "Fornecedor é obrigatório." });
  if (!dVenc)
    return res.status(400).json({ error: "Data de vencimento é obrigatória." });

  try {
    const transaction = db.transaction(() => {
      // generate unique NF identifier using timestamp
      const nNFManual = `MANUAL-${Date.now()}`;

      const result = db
        .prepare(
          `
        INSERT INTO notas_fiscais (nNF, xNome, tipo, dhEmi, status_pagamento)
        VALUES (?, ?, ?, ?, 'Aberta')
      `,
        )
        .run(nNFManual, xNome, tipo || null, dhEmi || null);

      const nfId = result.lastInsertRowid;

      db.prepare(
        `
        INSERT INTO nf_duplicatas (nf_id, nDup, dVenc, vDup, status, manual)
        VALUES (?, '001', ?, ?, 'Aberta', 1)
      `,
      ).run(nfId, dVenc, valor || 0);

      db.prepare(
        `
        INSERT INTO nf_itens_fiscal (nf_id, xProd, qCom, uCom, vUnCom, vProd)
        VALUES (?, ?, 1, 'UN', ?, ?)
      `,
      ).run(nfId, xNome, valor || 0, valor || 0);

      return nfId;
    });

    const nfId = transaction();
    res.json({ success: true, id: nfId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//START OF THE ERP REPORTS SECTION
// GET - KPI dashboard data
app.get("/relatorios/kpi", (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().substring(0, 7);
    const [ano, mesNum] = mes.split("-");
    const inicioMes = `${mes}-01`;
    const fimMes = new Date(parseInt(ano), parseInt(mesNum), 0)
      .toISOString()
      .split("T")[0];
    const hoje = new Date().toISOString().split("T")[0];

    // A Pagar este mês (Entrada, Aberta, vence este mês)
    const aPagar = db
      .prepare(
        `
      SELECT COALESCE(SUM(d.vDup), 0) as total
      FROM nf_duplicatas d
      JOIN notas_fiscais nf ON nf.id = d.nf_id
      WHERE d.status = 'Aberta'
        AND nf.direcao = 'Entrada'
        AND d.dVenc >= ? AND d.dVenc <= ?
    `,
      )
      .get(inicioMes, fimMes);

    // A Receber este mês (Saída, Aberta, vence este mês)
    const aReceber = db
      .prepare(
        `
      SELECT COALESCE(SUM(d.vDup), 0) as total
      FROM nf_duplicatas d
      JOIN notas_fiscais nf ON nf.id = d.nf_id
      WHERE d.status = 'Aberta'
        AND nf.direcao = 'Saída'
        AND d.dVenc >= ? AND d.dVenc <= ?
    `,
      )
      .get(inicioMes, fimMes);

    // Vencido em aberto (all directions, overdue)
    const vencido = db
      .prepare(
        `
      SELECT COALESCE(SUM(d.vDup), 0) as total
      FROM nf_duplicatas d
      JOIN notas_fiscais nf ON nf.id = d.nf_id
      WHERE d.status = 'Aberta'
        AND d.dVenc < ?
        AND nf.direcao != 'Sem valor financeiro'
    `,
      )
      .get(hoje);

    // last 6 months bar chart data
    const ultimos6Meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const inicio = `${ano}-${mes}-01`;
      const fim = new Date(ano, d.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0];

      const entradas = db
        .prepare(
          `
        SELECT COALESCE(SUM(d.vDup), 0) as total
        FROM nf_duplicatas d
        JOIN notas_fiscais nf ON nf.id = d.nf_id
        WHERE nf.direcao = 'Saída'
          AND d.dVenc >= ? AND d.dVenc <= ?
      `,
        )
        .get(inicio, fim);

      const saidas = db
        .prepare(
          `
        SELECT COALESCE(SUM(d.vDup), 0) as total
        FROM nf_duplicatas d
        JOIN notas_fiscais nf ON nf.id = d.nf_id
        WHERE nf.direcao = 'Entrada'
          AND d.dVenc >= ? AND d.dVenc <= ?
      `,
        )
        .get(inicio, fim);

      ultimos6Meses.push({
        mes: `${mes}/${ano}`,
        entradas: entradas.total,
        saidas: saidas.total,
      });
    }

    // donut chart — open vs paid this month
    const dupAbertasMes = db
      .prepare(
        `
      SELECT COALESCE(SUM(d.vDup), 0) as total
      FROM nf_duplicatas d
      JOIN notas_fiscais nf ON nf.id = d.nf_id
      WHERE d.status = 'Aberta'
        AND d.dVenc >= ? AND d.dVenc <= ?
        AND nf.direcao != 'Sem valor financeiro'
    `,
      )
      .get(inicioMes, fimMes);

    const dupPagasMes = db
      .prepare(
        `
      SELECT COALESCE(SUM(d.vDup), 0) as total
      FROM nf_duplicatas d
      JOIN notas_fiscais nf ON nf.id = d.nf_id
      WHERE d.status = 'Paga'
        AND d.data_pagamento >= ? AND d.data_pagamento <= ?
        AND nf.direcao != 'Sem valor financeiro'
    `,
      )
      .get(inicioMes, fimMes);

    res.json({
      aPagar: aPagar.total,
      aReceber: aReceber.total,
      vencido: vencido.total,
      saldoProjetado: aReceber.total - aPagar.total,
      ultimos6Meses,
      donut: {
        abertas: dupAbertasMes.total,
        pagas: dupPagasMes.total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
