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

    if (["Faturado", "Cancelado"].includes(current.status)) {
      return res.status(403).json({
        error: "Este pedido não pode ser editado no status atual.",
      });
    }

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
      Criado: ["Enviado", "Cancelado"],
      Enviado: ["Entregue", "Cancelado"],
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

// start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
