/* ─── STATE ─── */
let currentPedidoId = null;

/* ─── ELEMENTS ─── */
const btnSalvarPedido = document.getElementById("btn-salvar-pedido");
const btnClonarPedido = document.getElementById("btn-clonar-pedido");
const statusPedido = document.getElementById("statusPedido");
const statusSelect = document.getElementById("statusSelect");
const alteradoPor = document.getElementById("alteradoPor");
const observacaoStatus = document.getElementById("observacaoStatus");
/* NOTAS FISCAIS VARIABLES */
const numeroNF = document.getElementById("numeroNF");
const btnAdicionarNF = document.getElementById("btn-adicionar-nf");
const btnConfirmarNF = document.getElementById("btn-confirmar-nf");
const btnCancelarNF = document.getElementById("btn-cancelar-nf");
const nfItensSelector = document.getElementById("nf-itens-selector");
const nfCheckboxes = document.getElementById("nf-checkboxes");
const listaNFs = document.getElementById("lista-nfs");
/* VARIAVEIS PARA CALCULO DE DATA PREVISTA */
const prazoEntrega = document.getElementById("prazoEntrega");
const dataPrevista = document.getElementById("dataPrevista");

const responsavelSelect = document.getElementById("responsavelSelect");

// load usuarios into dropdown
carregarUsuarios().then(() => {
  usuarios.forEach((u) => {
    const option = document.createElement("option");
    option.value = u.id;
    option.textContent = u.nome;
    if (responsavelSelect) responsavelSelect.appendChild(option);
  });
});

// autofill fields when responsavel is selected
if (responsavelSelect) {
  responsavelSelect.addEventListener("change", () => {
    const usuario = usuarios.find((u) => u.id == responsavelSelect.value);
    if (!usuario) return;
    document.getElementById("comprador").value = usuario.nome;
    document.getElementById("compradorEmail").value = usuario.email;
    document.getElementById("compradorTelefone").value = usuario.telefone;
  });
}

/* CÁLCULO DE DATAS */
function calcularDataPrevista() {
  const dataPedido = document.getElementById("dataPedido").value;
  const prazo = parseInt(prazoEntrega.value);

  if (!dataPedido || isNaN(prazo)) {
    dataPrevista.value = "";
    return;
  }

  const [ano, mes, dia] = dataPedido.split("-");
  const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  data.setDate(data.getDate() + prazo);

  const diaFormatado = String(data.getDate()).padStart(2, "0");
  const mesFormatado = String(data.getMonth() + 1).padStart(2, "0");
  const anoFormatado = data.getFullYear();

  dataPrevista.value = `${diaFormatado}/${mesFormatado}/${anoFormatado}`;
}

// recalculate whenever either field changes
document
  .getElementById("dataPedido")
  ?.addEventListener("input", calcularDataPrevista);
prazoEntrega?.addEventListener("input", calcularDataPrevista);

/* ─── STATUS ─── */
const transicoesPermitidas = {
  Criado: ["Recebido", "Recebido Parcialmente", "Cancelado"],
  "Recebido Parcialmente": ["Recebido", "Cancelado"],
  Recebido: [],
  Cancelado: [],
};

function atualizarOpcoesStatus(statusAtual) {
  const permitidas = transicoesPermitidas[statusAtual] || [];
  statusSelect.innerHTML = `<option value="${statusAtual}">${statusAtual}</option>`;
  permitidas.forEach((s) => {
    const option = document.createElement("option");
    option.value = s;
    option.textContent = s;
    statusSelect.appendChild(option);
  });
}

/* ─── COLLECT FORM DATA ─── */
function getItensFromTable() {
  const tableBody = document.querySelector("#itens-table tbody");
  return Array.from(tableBody.rows).map((row, index) => ({
    id: row.dataset.itemId ? parseInt(row.dataset.itemId) : null,
    item: index + 1,
    quantidade:
      parseFloat(
        (row.cells[2]?.textContent || "0")
          .replace(/[^\d,.-]/g, "")
          .replace(/\./g, "")
          .replace(",", "."),
      ) || 0,
    descricao: row.cells[3]?.textContent || "",
    unidade: row.cells[4]?.textContent || "",
    val_unitario:
      parseFloat(
        (row.cells[5]?.textContent || "0")
          .replace(/[^\d,.-]/g, "")
          .replace(/\./g, "")
          .replace(",", "."),
      ) || 0,
    ipi:
      parseFloat(
        (row.cells[6]?.textContent || "0")
          .replace(/[^\d,.-]/g, "")
          .replace(/\./g, "")
          .replace(",", "."),
      ) || 0,
    total:
      parseFloat(
        (row.cells[7]?.textContent || "0")
          .replace(/[^\d,.-]/g, "")
          .replace(/\./g, "")
          .replace(",", "."),
      ) || 0,
  }));
}

function buildPayload() {
  return {
    num_pedido: document.getElementById("numPedido")?.value.toUpperCase() || "",
    data_pedido: document.getElementById("dataPedido")?.value || "",
    fornecedor_id: document.getElementById("fornecedor")?.value || null,
    prazo_entrega: document.getElementById("prazoEntrega")?.value || "",
    data_prevista: dataPrevista?.value || "",
    num_proposta: document.getElementById("numProposta")?.value || "",
    cond_pagamento: document.getElementById("condPagamento")?.value || "",
    observacoes: document.getElementById("observações")?.value || "",
    observacoes_tecnicas:
      document.getElementById("observacoes-tecnicas")?.value || "",
    aplicacao: document.getElementById("aplicacao")?.value || "",
    endereco_entrega: document.getElementById("enderecoEntrega")?.value || "",
    comprador: document.getElementById("comprador")?.value || "",
    comprador_email: document.getElementById("compradorEmail")?.value || "",
    comprador_telefone:
      document.getElementById("compradorTelefone")?.value || "",
    alterado_por: alteradoPor?.value || "",
    itens: getItensFromTable(),
  };
}

/* ─── SAVE ─── */
if (btnSalvarPedido) {
  btnSalvarPedido.addEventListener("click", async () => {
    const payload = buildPayload();

    if (!payload.num_pedido) {
      alert("Por favor, informe o número do pedido.");
      return;
    }
    if (!payload.fornecedor_id) {
      alert("Por favor, selecione um fornecedor.");
      return;
    }

    if (currentPedidoId) {
      // update existing
      const result = await fetch(
        `http://localhost:3000/pedidos/${currentPedidoId}`,
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
        alert("Pedido atualizado com sucesso!");
        // refresh item IDs from server to keep dataset.itemId current
        const pedidoRes = await fetch(
          `http://localhost:3000/pedidos/${currentPedidoId}`,
        );
        const pedido = await pedidoRes.json();
        const tableBody = document.querySelector("#itens-table tbody");
        Array.from(tableBody.rows).forEach((row, index) => {
          if (pedido.itens[index]) {
            row.dataset.itemId = pedido.itens[index].id;
          }
        });
      }
    } else {
      // create new
      const result = await fetch("http://localhost:3000/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        currentPedidoId = data.id;
        alert("Pedido salvo com sucesso!");
        atualizarOpcoesStatus("Criado");
      }
    }
  });
}

/* ─── STATUS CHANGE ─── */
if (statusSelect) {
  statusSelect.addEventListener("change", async () => {
    if (!currentPedidoId) {
      alert("Salve o pedido antes de alterar o status.");
      statusSelect.value = statusPedido.value;
      return;
    }

    if (!alteradoPor?.value) {
      alert("Por favor, informe quem está alterando o status.");
      statusSelect.value = statusPedido.value;
      return;
    }

    const statusNovo = statusSelect.value;

    const result = await fetch(
      `http://localhost:3000/pedidos/${currentPedidoId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status_novo: statusNovo,
          alterado_por: alteradoPor.value,
          observacao: observacaoStatus?.value || "",
        }),
      },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
      statusSelect.value = statusPedido.value;
    } else {
      statusPedido.value = statusNovo;
      atualizarOpcoesStatus(statusNovo);
      alert(`Status alterado para "${statusNovo}" com sucesso!`);
    }
  });
}

/* ─── NOTAS FISCAIS (read-only, from notas_fiscais table) ─── */
async function carregarNFsPedido() {
  if (!currentPedidoId) return;

  const secaoNFs = document.getElementById("secao-nfs");
  const listaNFs = document.getElementById("lista-nfs-pedido");

  if (!secaoNFs || !listaNFs) return;

  secaoNFs.style.display = "block";

  const res = await fetch(
    `http://localhost:3000/pedidos/${currentPedidoId}/notas-fiscais`,
  );
  const nfs = await res.json();

  if (nfs.length === 0) {
    listaNFs.innerHTML = `<p>Nenhuma nota fiscal vinculada a este pedido.</p>`;
    return;
  }

  listaNFs.innerHTML = "";
  nfs.forEach((nf) => {
    const itensList =
      nf.itens.length > 0
        ? nf.itens
            .map(
              (i) => `
              <li>
                ${i.xProd} — 
                ${i.qCom} ${i.uCom} — 
                ${i.vProd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </li>`,
            )
            .join("")
        : "<li>Nenhum item na nota fiscal</li>";

    const div = document.createElement("div");
    div.className = "nf-item";
    div.innerHTML = `
      <div class="nf-header">
        <strong>NF ${nf.nNF}</strong>
        <span>${nf.xNome}</span>
        <span>${
          nf.valor_total
            ? nf.valor_total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "-"
        }</span>
        <span class="nf-status ${nf.status_pagamento === "Paga" ? "status-paga" : "status-aberta"}">
          ${nf.status_pagamento}
        </span>
      </div>
      <ul class="nf-itens-list">${itensList}</ul>
    `;
    listaNFs.appendChild(div);
  });
}

/* ─── LOAD EXISTING PEDIDO ─── */
async function carregarPedido(id) {
  const res = await fetch(`http://localhost:3000/pedidos/${id}`);
  const pedido = await res.json();

  document.getElementById("numPedido").value = pedido.num_pedido || "";
  document.getElementById("dataPedido").value = pedido.data_pedido || "";
  document.getElementById("prazoEntrega").value = pedido.prazo_entrega || "";
  document.getElementById("dataPrevista").value = pedido.data_prevista || "";
  document.getElementById("numProposta").value = pedido.num_proposta || "";
  document.getElementById("condPagamento").value = pedido.cond_pagamento || "";
  document.getElementById("observações").value = pedido.observacoes || "";
  document.getElementById("observacoes-tecnicas").value =
    pedido.observacoes_tecnicas || "";
  document.getElementById("aplicacao").value = pedido.aplicacao || "";
  document.getElementById("enderecoEntrega").value =
    pedido.endereco_entrega || "";
  document.getElementById("comprador").value = pedido.comprador || "";
  document.getElementById("compradorEmail").value =
    pedido.comprador_email || "";
  document.getElementById("compradorTelefone").value =
    pedido.comprador_telefone || "";

  // set supplier dropdown
  const selectFornecedor = document.getElementById("fornecedor");
  if (selectFornecedor) selectFornecedor.value = pedido.fornecedor_id;

  // trigger autofill of supplier fields
  const findFornecedor = fornecedores.find((f) => f.id == pedido.fornecedor_id);
  if (findFornecedor) {
    document.getElementById("cnpj").value = formatCNPJ(findFornecedor.cnpj);
    document.getElementById("ie").value = findFornecedor.ie;
    document.getElementById("rua").value = findFornecedor.rua;
    document.getElementById("bairro").value = findFornecedor.bairro;
    document.getElementById("cidade").value = findFornecedor.cidade;
    document.getElementById("estado").value = findFornecedor.estado;
  }

  // populate items table
  const tableBody = document.querySelector("#itens-table tbody");
  tableBody.innerHTML = "";
  (pedido.itens || []).forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.dataset.itemId = item.id;
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td>${index + 1}</td>
      <td contenteditable="true" class="quantidade">${item.quantidade}</td>
      <td contenteditable="true">${item.descricao}</td>
      <td contenteditable="true">${item.unidade}</td>
      <td contenteditable="true" class="val-unitario">${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td contenteditable="true" class="ipi">${item.ipi != null ? String(item.ipi).replace(".", ",") : ""}</td>
      <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
    `;
    tableBody.appendChild(tr);
  });

  calcTotalGeral();

  // set status
  statusPedido.value = pedido.status || "Criado";
  atualizarOpcoesStatus(pedido.status || "Criado");
  await carregarNFsPedido();
}

// Ações ao clicar em Gerar PDF
const btnGerarPdf = document.getElementById("btn-gerar-pdf");

if (btnGerarPdf) {
  btnGerarPdf.addEventListener("click", () => {
    if (!currentPedidoId) {
      alert("Salve o pedido antes de gerar o PDF.");
      return;
    }
    window.open(
      `http://localhost:3000/pedidos/${currentPedidoId}/pdf`,
      "_blank",
    );
  });
}

if (btnClonarPedido) {
  btnClonarPedido.addEventListener("click", async () => {
    if (
      !confirm(
        "Deseja clonar este pedido? Um novo pedido será criado com as mesmas informações.",
      )
    )
      return;

    const result = await fetch(
      `http://localhost:3000/pedidos/${currentPedidoId}/clonar`,
      { method: "POST" },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      // open cloned pedido in new tab
      window.open(`../pages/formFornecedores.html?id=${data.id}`, "_blank");
    }
  });
}

if (btnClonarPedido) btnClonarPedido.style.display = "inline-block";

/* ─── ON LOAD ─── */
const urlParams = new URLSearchParams(window.location.search);
const pedidoIdFromUrl = urlParams.get("id");

// show clone button only when editing existing pedido
if (pedidoIdFromUrl && btnClonarPedido) {
  btnClonarPedido.style.display = "inline-block";
}

if (pedidoIdFromUrl) {
  currentPedidoId = parseInt(pedidoIdFromUrl);
  // fornecedores are already loaded by formFornecedores.js
  // so we just wait for the DOM to be ready then load the pedido
  carregarFornecedores().then(() => {
    carregarPedido(currentPedidoId);
  });
} else {
  atualizarOpcoesStatus("Criado");
}
