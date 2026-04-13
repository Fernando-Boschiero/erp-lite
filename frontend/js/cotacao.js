/* ─── QUILL EDITORS ─── */
const quillDescricao = new Quill("#editor-descricao", {
  theme: "snow",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["image", "link"],
      ["clean"],
    ],
  },
});

const quillCondicoes = new Quill("#editor-condicoes", {
  theme: "snow",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  },
});

const quillCondicoesGerais = new Quill("#editor-condicoes-gerais", {
  theme: "snow",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  },
});

/* ─── BOILERPLATE - condições gerais de venda ─── */
// Pre-fills the condições gerais editor with standard legal text
const condicoesGeraisBoilerplate = `
<p><strong>INTRODUÇÃO:</strong> O presente documento tem o propósito de apresentar a Política associada ao fornecimento, crédito, garantia e assuntos relacionados à venda.</p>
<p><strong>1. CONDIÇÕES GERAIS:</strong> Esta venda está sujeita aos termos e condições especificados neste documento, bem como na proposta, pedido e/ou fatura fornecida pela VEIKON EQUIPAMENTOS E SERVIÇOS LTDA. ("VEIKON ENGENHARIA").</p>
<p>1.1. Não será aceita qualquer adição ou alteração promovida unilateralmente pelo cliente.</p>
<p>1.2. Todos os pedidos devem ser transmitidos de maneira formal, através de fax ou e-mail.</p>
<p><strong>2. ACEITE:</strong> O pedido de compra gerado pelo cliente e enviado à VEIKON ENGENHARIA implica aceitação por parte do cliente dos termos e condições previstos no presente documento.</p>
<p><strong>3. CANCELAMENTO:</strong> Em caso de cancelamento de pedido após início dos processos de fabricação, VEIKON ENGENHARIA cobrará uma indenização de 40% do valor do pedido. Após 4 semanas de aceite do pedido, será cobrado 100% da ordem de compra.</p>
<p><strong>4. GARANTIA:</strong> A todos os produtos novos fabricados pela VEIKON ENGENHARIA é dada uma garantia contra defeitos dos materiais ou de fabricação pelo período de 1 (um) ano contado a partir da data de entrega.</p>
<p><strong>5. LIMITAÇÃO DE RESPONSABILIDADE:</strong> A responsabilidade da VEIKON ENGENHARIA pelos seus produtos é limitada a reparos e/ou substituição de peças, ou ao reembolso total do valor do produto.</p>
<p><strong>6. RETORNO DE MERCADORIAS:</strong> Todos os produtos da VEIKON ENGENHARIA são produzidos sob encomenda. O retorno de produtos será condicionado à aprovação prévia por escrito da VEIKON ENGENHARIA.</p>
<p><strong>7. ATRASOS NA ENTREGA:</strong> A VEIKON ENGENHARIA não poderá ser responsabilizada por atrasos decorrentes de caso fortuito ou força maior.</p>
<p><strong>8. FORO:</strong> Eventuais ações judiciais serão submetidas ao foro da Comarca de Vinhedo, Estado de São Paulo.</p>
<p><strong><em>VALIDADE DA PROPOSTA: PROPOSTA VÁLIDA CONFORME INDICADO NAS CONDIÇÕES COMERCIAIS.</em></strong></p>
`;

quillCondicoesGerais.root.innerHTML = condicoesGeraisBoilerplate;

/* ─── TABLE - line items ─── */
const tableBody = document.querySelector("#itens-table tbody");
const addRowBtn = document.getElementById("add-row");
const deleteRowBtn = document.getElementById("delete-row");

const parseBR = (value) => {
  return (
    parseFloat(
      value
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    ) || 0
  );
};

const applyNumFormatting = (value, min = 0, fallback = "0") => {
  value = value
    .replace(/[^0-9.,]/g, "")
    .replace(/\./g, ",")
    .replace(/(,.*),/g, "$1");
  let num = parseFloat(value.replace(",", "."));
  if (isNaN(num) || num < min) return fallback;
  return num;
};

const calcRow = (row) => {
  const qntText = row.querySelector(".quantidade")?.textContent || "0";
  const valText = row.querySelector(".val-unitario")?.textContent || "0";

  const qnt = parseBR(qntText);
  const valUnit = parseBR(valText);
  const total = qnt * valUnit;

  const cellTotal = row.cells[6];
  if (cellTotal) {
    cellTotal.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return total;
};

const calcTotalGeral = () => {
  let total = 0;
  Array.from(tableBody.rows).forEach((row) => {
    total += calcRow(row);
  });
  const campoTotal = document.getElementById("total-geral");
  if (campoTotal) {
    campoTotal.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
};

if (tableBody) {
  tableBody.addEventListener("focusout", (e) => {
    if (e.target.classList.contains("quantidade")) {
      e.target.textContent = applyNumFormatting(
        e.target.textContent,
        0,
        "1",
      ).toLocaleString("pt-BR");
    }
    if (e.target.classList.contains("val-unitario")) {
      e.target.textContent = applyNumFormatting(
        e.target.textContent,
        0,
        "0",
      ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const row = e.target.closest("tr");
    if (row) {
      calcRow(row);
      calcTotalGeral();
    }
  });

  // keyboard navigation
  tableBody.addEventListener("keydown", (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    const tr = td.parentElement;
    const rowIndex = tr.rowIndex - 1;
    const cellIndex = td.cellIndex;
    let target;

    if (e.key === "ArrowRight") target = tr.cells[cellIndex + 1];
    if (e.key === "ArrowLeft") target = tr.cells[cellIndex - 1];
    if (e.key === "ArrowDown")
      target = tableBody.rows[rowIndex + 1]?.cells[cellIndex];
    if (e.key === "ArrowUp")
      target = tableBody.rows[rowIndex - 1]?.cells[cellIndex];

    if (target && target.hasAttribute("contenteditable")) {
      e.preventDefault();
      target.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(target);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}

if (addRowBtn) {
  addRowBtn.addEventListener("click", () => {
    const rowCount = tableBody.rows.length + 1;
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td>${rowCount}</td>
      <td contenteditable="true" class="quantidade"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true" class="val-unitario"></td>
      <td></td>
    `;
    tableBody.appendChild(newRow);
  });
}

if (deleteRowBtn) {
  deleteRowBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".row-select:checked");
    checkboxes.forEach((cb) => cb.closest("tr").remove());
    Array.from(tableBody.rows).forEach((row, index) => {
      row.cells[1].textContent = index + 1;
    });
    calcTotalGeral();
  });
}

/* ─── HELPERS ─── */
function getItensFromTable() {
  return Array.from(tableBody.rows).map((row, index) => ({
    item: index + 1,
    quantidade: parseBR(row.cells[2]?.textContent || "0"),
    descricao: row.cells[3]?.textContent || "",
    unidade: row.cells[4]?.textContent || "",
    val_unitario: parseBR(row.cells[5]?.textContent || "0"),
    total: parseBR(row.cells[6]?.textContent || "0"),
  }));
}

function populateItensTable(itens) {
  tableBody.innerHTML = "";
  itens.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td>${index + 1}</td>
      <td contenteditable="true" class="quantidade">${item.quantidade}</td>
      <td contenteditable="true">${item.descricao}</td>
      <td contenteditable="true">${item.unidade}</td>
      <td contenteditable="true" class="val-unitario">${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
    `;
    tableBody.appendChild(tr);
  });
  calcTotalGeral();
}

function clearForm() {
  document.getElementById("numCotacao").value = "";
  document.getElementById("dataCotacao").value = "";
  document.getElementById("revisao").value = "0";
  document.getElementById("status").value = "Criada";
  document.getElementById("cliente").value = "";
  document.getElementById("clienteContato").value = "";
  document.getElementById("clienteEmail").value = "";
  document.getElementById("prazoEntrega").value = "";
  document.getElementById("validadeProposta").value = "";
  document.getElementById("condPagamento").value = "";
  document.getElementById("moeda").value = "BRL";
  document.getElementById("objetivo").value = "";
  document.getElementById("alteradoPor").value = "";
  document.getElementById("observacaoStatus").value = "";
  document.getElementById("comprador").value = "";
  document.getElementById("compradorEmail").value = "";
  document.getElementById("compradorTelefone").value = "";
  document.getElementById("statusSelect").value = "Criada";
  quillDescricao.root.innerHTML = "";
  quillCondicoes.root.innerHTML = "";
  quillCondicoesGerais.root.innerHTML = condicoesGeraisBoilerplate;
  tableBody.innerHTML = `
    <tr>
      <td><input type="checkbox" class="row-select"></td>
      <td>1</td>
      <td contenteditable="true" class="quantidade"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true" class="val-unitario"></td>
      <td></td>
    </tr>
  `;
}

function buildPayload() {
  return {
    num_cotacao: document.getElementById("numCotacao").value,
    data_cotacao: document.getElementById("dataCotacao").value,
    cliente: document.getElementById("cliente").value,
    cliente_contato: document.getElementById("clienteContato").value,
    cliente_email: document.getElementById("clienteEmail").value,
    prazo_entrega: document.getElementById("prazoEntrega").value,
    validade_proposta: document.getElementById("validadeProposta").value,
    cond_pagamento: document.getElementById("condPagamento").value,
    moeda: document.getElementById("moeda").value,
    objetivo: document.getElementById("objetivo").value,
    descricao_equipamentos: quillDescricao.root.innerHTML,
    condicoes_proposta: quillCondicoes.root.innerHTML,
    condicoes_gerais: quillCondicoesGerais.root.innerHTML,
    comprador: document.getElementById("comprador").value,
    comprador_email: document.getElementById("compradorEmail").value,
    comprador_telefone: document.getElementById("compradorTelefone").value,
    alterado_por: document.getElementById("alteradoPor").value,
    itens: getItensFromTable(),
  };
}

/* ─── MODE - new vs edit ─── */
// currentCotacaoId is set when loading an existing cotação for editing
let currentCotacaoId = null;

function setReadOnly(isReadOnly) {
  // disables all inputs when viewing a sent cotação
  const inputs = document.querySelectorAll(
    "#form-cotacao input:not([readonly]), #form-cotacao select",
  );
  inputs.forEach((el) => (el.disabled = isReadOnly));
  quillDescricao.enable(!isReadOnly);
  quillCondicoes.enable(!isReadOnly);
  quillCondicoesGerais.enable(!isReadOnly);
  tableBody.querySelectorAll("[contenteditable]").forEach((el) => {
    el.contentEditable = !isReadOnly;
  });
}

/* ─── SAVE ─── */
const btnSalvar = document.getElementById("btn-salvar");
const btnNovaRevisao = document.getElementById("btn-nova-revisao");

if (btnSalvar) {
  btnSalvar.addEventListener("click", async () => {
    const payload = buildPayload();

    if (!payload.num_cotacao) {
      alert("Por favor, informe o número da cotação.");
      return;
    }
    if (!payload.cliente) {
      alert("Por favor, informe o cliente.");
      return;
    }

    if (currentCotacaoId) {
      // update existing
      const result = await fetch(
        `http://localhost:3000/cotacoes/${currentCotacaoId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        alert("Cotação atualizada com sucesso!");
      }
    } else {
      // create new
      const result = await fetch("http://localhost:3000/cotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        currentCotacaoId = data.id;
        alert("Cotação salva com sucesso!");
      }
    }
  });
}

/* ─── STATUS CHANGE ─── */
const statusSelect = document.getElementById("statusSelect");

if (statusSelect) {
  statusSelect.addEventListener("change", async () => {
    if (!currentCotacaoId) {
      alert("Salve a cotação antes de alterar o status.");
      statusSelect.value = document.getElementById("status").value;
      return;
    }

    const alteradoPor = document.getElementById("alteradoPor").value;
    if (!alteradoPor) {
      alert("Por favor, informe quem está alterando o status.");
      statusSelect.value = document.getElementById("status").value;
      return;
    }

    const observacao = document.getElementById("observacaoStatus").value;
    const statusNovo = statusSelect.value;

    const result = await fetch(
      `http://localhost:3000/cotacoes/${currentCotacaoId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_novo: statusNovo,
          alterado_por: alteradoPor,
          observacao,
        }),
      },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      // update the readonly status display
      document.getElementById("status").value = statusNovo;

      // if sent to client, lock the form and show nova revisao button
      if (statusNovo === "Enviado ao Cliente") {
        setReadOnly(true);
        if (btnNovaRevisao) btnNovaRevisao.style.display = "inline-block";
        if (btnSalvar) btnSalvar.style.display = "none";
      }

      alert(`Status alterado para "${statusNovo}" com sucesso!`);
    }
  });
}

/* ─── NOVA REVISÃO ─── */
if (btnNovaRevisao) {
  btnNovaRevisao.addEventListener("click", async () => {
    const alteradoPor = document.getElementById("alteradoPor").value;
    if (!alteradoPor) {
      alert("Por favor, informe quem está criando a revisão.");
      return;
    }

    const result = await fetch(
      `http://localhost:3000/cotacoes/${currentCotacaoId}/revisao`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alterado_por: alteradoPor }),
      },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      // load the new revision into the form
      currentCotacaoId = data.id;
      await carregarCotacao(data.id);
      alert("Nova revisão criada com sucesso!");
    }
  });
}

/* ─── LOAD EXISTING COTAÇÃO ─── */
async function carregarCotacao(id) {
  const res = await fetch(`http://localhost:3000/cotacoes/${id}`);
  const cotacao = await res.json();

  document.getElementById("numCotacao").value = cotacao.num_cotacao;
  document.getElementById("dataCotacao").value = cotacao.data_cotacao;
  document.getElementById("revisao").value = cotacao.revisao;
  document.getElementById("status").value = cotacao.status;
  document.getElementById("cliente").value = cotacao.cliente;
  document.getElementById("clienteContato").value =
    cotacao.cliente_contato || "";
  document.getElementById("clienteEmail").value = cotacao.cliente_email || "";
  document.getElementById("prazoEntrega").value = cotacao.prazo_entrega || "";
  document.getElementById("validadeProposta").value =
    cotacao.validade_proposta || "";
  document.getElementById("condPagamento").value = cotacao.cond_pagamento || "";
  document.getElementById("moeda").value = cotacao.moeda || "BRL";
  document.getElementById("objetivo").value = cotacao.objetivo || "";
  document.getElementById("statusSelect").value = cotacao.status;
  document.getElementById("comprador").value = cotacao.comprador || "";
  document.getElementById("compradorEmail").value =
    cotacao.comprador_email || "";
  document.getElementById("compradorTelefone").value =
    cotacao.comprador_telefone || "";

  quillDescricao.root.innerHTML = cotacao.descricao_equipamentos || "";
  quillCondicoes.root.innerHTML = cotacao.condicoes_proposta || "";
  quillCondicoesGerais.root.innerHTML =
    cotacao.condicoes_gerais || condicoesGeraisBoilerplate;

  populateItensTable(cotacao.itens || []);

  // if already sent to client, lock the form
  if (cotacao.status === "Enviado ao Cliente") {
    setReadOnly(true);
    if (btnNovaRevisao) btnNovaRevisao.style.display = "inline-block";
    if (btnSalvar) btnSalvar.style.display = "none";
  } else {
    setReadOnly(false);
    if (btnNovaRevisao) btnNovaRevisao.style.display = "none";
    if (btnSalvar) btnSalvar.style.display = "inline-block";
  }
}

/* ─── ON LOAD ─── */
// Check if a cotação id was passed in the URL, e.g. cotacao.html?id=5
const urlParams = new URLSearchParams(window.location.search);
const cotacaoIdFromUrl = urlParams.get("id");

if (cotacaoIdFromUrl) {
  currentCotacaoId = parseInt(cotacaoIdFromUrl);
  carregarCotacao(currentCotacaoId);
}

const btnImprimir = document.getElementById("btn-imprimir");

if (btnImprimir) {
  btnImprimir.addEventListener("click", () => {
    if (!currentCotacaoId) {
      alert("Salve a cotação antes de gerar o PDF.");
      return;
    }
    window.open(
      `http://localhost:3000/cotacoes/${currentCotacaoId}/pdf`,
      "_blank",
    );
  });
}
