/* ─── STATE ─── */
let allNFs = [];
let pedidos = [];

/* ─── ELEMENTS ─── */
const searchInput = document.getElementById("searchInput");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltro = document.getElementById("btn-limpar-filtro");
const btnAtualizar = document.getElementById("btn-atualizar");
const tabelaBody = document.getElementById("tabela-nfs-body");

/* ─── SET DEFAULT DATE RANGE (90 days) ─── */
function setDefaultDates() {
  const hoje = new Date();
  const noventaDiasAtras = new Date();
  noventaDiasAtras.setDate(hoje.getDate() - 90);
  dataFim.value = hoje.toISOString().split("T")[0];
  dataInicio.value = noventaDiasAtras.toISOString().split("T")[0];
}

/* ─── FETCH DATA ─── */
async function carregarNFs() {
  const res = await fetch("http://localhost:3000/notas-fiscais");
  allNFs = await res.json();
  renderTabela();
}

// FORMATAR DATA PARA TIMEZONE BRASIL
function formatarDataSimples(dateStr) {
  if (!dateStr) return "-";
  // handle ISO datetime strings
  if (dateStr.includes("T")) {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  }
  // handle YYYY-MM-DD without timezone shift
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* ─── SORTING ─── */
let sortCol = null;
let sortDir = 1;

document.querySelectorAll(".sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const col = btn.dataset.col;
    if (sortCol === col) {
      sortDir *= -1;
    } else {
      sortCol = col;
      sortDir = 1;
    }
    document
      .querySelectorAll(".sort-btn")
      .forEach((b) => (b.textContent = "↕"));
    btn.textContent = sortDir === 1 ? "↑" : "↓";
    renderTabela();
  });
});

/* ─── RENDER ─── */
function renderTabela() {
  const search = searchInput.value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const inicio = dataInicio.value ? new Date(dataInicio.value) : null;
  const fim = dataFim.value ? new Date(dataFim.value + "T23:59:59") : null;

  const filtered = allNFs.filter((nf) => {
    if (inicio || fim) {
      const dataStr = nf.dhEmi ? nf.dhEmi.substring(0, 10) : null;
      if (dataStr) {
        const dataRef = new Date(dataStr + "T00:00:00");
        if (inicio && dataRef < inicio) return false;
        if (fim && dataRef > fim) return false;
      }
    }

    const searchable = [
      nf.nNF,
      nf.xNome,
      nf.tipo,
      nf.num_pedido,
      nf.aplicacao,
      nf.status_pagamento,
      nf.direcao, // ← add this
    ]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return searchable.includes(search);
  });

  // sort if column selected
  if (sortCol) {
    filtered.sort((a, b) => {
      const valA = sortCol === "dVenc" ? a.proxima_duplicata : a.dhEmi;
      const valB = sortCol === "dVenc" ? b.proxima_duplicata : b.dhEmi;
      if (!valA) return 1;
      if (!valB) return -1;
      return valA > valB ? sortDir : valA < valB ? -sortDir : 0;
    });
  }

  tabelaBody.innerHTML = "";
  let totalValor = 0;

  filtered.forEach((nf) => {
    totalValor += nf.valor_nf || 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="../pages/editarNF.html?id=${nf.id}"
           style="color: #0d6efd; text-decoration: none; font-weight: bold;">
          ${nf.nNF && !nf.nNF.startsWith("MANUAL-") ? nf.nNF : "Manual"}
        </a>
      </td>
      <td>${formatarDataSimples(nf.dhEmi)}</td>
      <td>${formatarDataSimples(nf.proxima_duplicata)}</td>
      <td>${nf.xNome ?? "-"}</td>
      <td>${nf.tipo ?? "-"}</td>
      <td>${
        nf.valor_nf
          ? nf.valor_nf.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "-"
      }</td>
      <td>
        <span style="color: ${nf.status_pagamento === "Paga" ? "#198754" : "#dc3545"}; font-weight: bold;">
          ${nf.status_pagamento ?? "-"}
        </span>
      </td>
      <td>
  <span style="color: ${
    nf.direcao === "Saída"
      ? "#084298"
      : nf.direcao === "Sem valor financeiro"
        ? "#6c757d"
        : "#dc3545"
  }; font-weight: bold;">
    ${nf.direcao ?? "Entrada"}
  </span>
</td>
      <td class="no-print">
        <a href="../pages/editarNF.html?id=${nf.id}">✏️</a>
        <button type="button" class="btn-deletar-nf" data-id="${nf.id}"
          style="background: none; border: none; cursor: pointer;">🗑️</button>
      </td>
    `;
    tabelaBody.appendChild(tr);
  });

  document.getElementById("total-registros").textContent = filtered.length;
  document.getElementById("total-valor").textContent =
    totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // delete buttons
  tabelaBody.querySelectorAll(".btn-deletar-nf").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja excluir esta nota fiscal?")) return;
      const result = await fetch(
        `http://localhost:3000/notas-fiscais/${btn.dataset.id}`,
        { method: "DELETE" },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        await carregarNFs();
      }
    });
  });
}

/* ─── MODAL NOVO LANÇAMENTO ─── */
const btnNovoLancamento = document.getElementById("btn-novo-lancamento");
const modalLancamento = document.getElementById("modal-lancamento");
const btnSalvarLancamento = document.getElementById("btn-salvar-lancamento");
const btnCancelarLancamento = document.getElementById(
  "btn-cancelar-lancamento",
);

if (btnNovoLancamento) {
  btnNovoLancamento.addEventListener("click", () => {
    modalLancamento.style.display = "flex";
  });
}

if (btnCancelarLancamento) {
  btnCancelarLancamento.addEventListener("click", () => {
    modalLancamento.style.display = "none";
    limparModal();
  });
}

// close modal on outside click
if (modalLancamento) {
  modalLancamento.addEventListener("click", (e) => {
    if (e.target === modalLancamento) {
      modalLancamento.style.display = "none";
      limparModal();
    }
  });
}

function limparModal() {
  document.getElementById("lancFornecedor").value = "";
  document.getElementById("lancTipo").value = "";
  document.getElementById("lancValor").value = "";
  document.getElementById("lancDataEmissao").value = "";
  document.getElementById("lancVencimento").value = "";
  if (lancPedido) lancPedido.value = "";
  if (vinculoPedidoLancamento) vinculoPedidoLancamento.style.display = "none";
}

if (btnSalvarLancamento) {
  btnSalvarLancamento.addEventListener("click", async () => {
    const xNome = document.getElementById("lancFornecedor").value.trim();
    const tipo = document.getElementById("lancTipo").value;
    const valorRaw = document.getElementById("lancValor").value;
    const dVenc = document.getElementById("lancVencimento").value;
    const dhEmi = document.getElementById("lancDataEmissao").value;
    const pedidoId = lancPedido?.value || null;

    if (!xNome) {
      alert("Por favor, informe o fornecedor/descrição.");
      return;
    }
    if (!tipo) {
      alert("Por favor, selecione o tipo.");
      return;
    }
    if (tiposComPedido.includes(tipo) && !pedidoId) {
      alert("Por favor, selecione o pedido de compra.");
      return;
    }
    if (!dVenc) {
      alert("Por favor, informe a data de vencimento.");
      return;
    }

    const valor =
      parseFloat(valorRaw.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

    const result = await fetch("http://localhost:3000/notas-fiscais/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        xNome,
        tipo,
        valor,
        dVenc,
        dhEmi,
        pedido_id: pedidoId ? parseInt(pedidoId) : null,
      }),
    });

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      modalLancamento.style.display = "none";
      limparModal();
      await carregarNFs();
    }
  });
}

let tiposComPedido = [];

/* ─── LOAD PEDIDOS ─── */
async function carregarPedidosLancamento() {
  const res = await fetch("http://localhost:3000/pedidos");
  pedidos = await res.json();
  const lancPedido = document.getElementById("lancPedido");
  if (!lancPedido) return;
  pedidos.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.num_pedido} — ${p.razao_social}`;
    option.dataset.fornecedor = p.razao_social;
    option.dataset.aplicacao = p.aplicacao ?? "";
    lancPedido.appendChild(option);
  });
}

const lancTipo = document.getElementById("lancTipo");
const vinculoPedidoLancamento = document.getElementById(
  "vinculo-pedido-lancamento",
);
const lancPedido = document.getElementById("lancPedido");
const lancFornecedor = document.getElementById("lancFornecedor");

if (lancTipo) {
  lancTipo.addEventListener("change", () => {
    if (tiposComPedido.includes(lancTipo.value)) {
      vinculoPedidoLancamento.style.display = "block";
    } else {
      vinculoPedidoLancamento.style.display = "none";
      lancPedido.value = "";
    }
  });
}

if (lancPedido) {
  lancPedido.addEventListener("change", () => {
    const selected = lancPedido.options[lancPedido.selectedIndex];
    if (selected && selected.value) {
      lancFornecedor.value = selected.dataset.fornecedor || "";
    }
  });
}

async function carregarTiposNF() {
  const res = await fetch("http://localhost:3000/tipos-nf");
  const tipos = await res.json();

  const tiposGeral = tipos.filter((t) => t.categoria === "Geral");
  const tiposPC = tipos.filter((t) => t.categoria === "PC");
  const tiposCOT = tipos.filter((t) => t.categoria === "COT");

  tiposComPedido = tiposPC.map((t) => t.descricao);

  const select = document.getElementById("lancTipo");
  if (!select) return;

  // keep existing hardcoded options structure but clear dynamic optgroups
  const existingOptions = select.querySelector('option[value=""]');
  select.innerHTML = `<option value="">Selecione o tipo...</option>`;

  const groupGeral = document.createElement("optgroup");
  groupGeral.label = "Geral";
  tiposGeral.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.descricao;
    option.textContent = t.descricao;
    groupGeral.appendChild(option);
  });

  const groupPC = document.createElement("optgroup");
  groupPC.label = "Vinculado a Pedido de Compra";
  tiposPC.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.descricao;
    option.textContent = t.descricao;
    groupPC.appendChild(option);
  });

  const groupCOT = document.createElement("optgroup");
  groupCOT.label = "Vinculado a Cotação";
  tiposCOT.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.descricao;
    option.textContent = t.descricao;
    groupCOT.appendChild(option);
  });

  select.appendChild(groupGeral);
  select.appendChild(groupPC);
  select.appendChild(groupCOT);
}

/* ─── EVENT LISTENERS ─── */
if (searchInput) searchInput.addEventListener("input", renderTabela);
if (dataInicio) dataInicio.addEventListener("change", renderTabela);
if (dataFim) dataFim.addEventListener("change", renderTabela);
if (btnAtualizar) btnAtualizar.addEventListener("click", carregarNFs);
if (btnLimparFiltro) {
  btnLimparFiltro.addEventListener("click", () => {
    searchInput.value = "";
    setDefaultDates();
    renderTabela();
  });
}

/* ─── INIT ─── */
setDefaultDates();
carregarNFs();
carregarPedidosLancamento();
carregarTiposNF();
