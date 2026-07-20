/* ─── STATE ─── */
let allRows = [];

/* ─── ELEMENTS ─── */
const searchInput = document.getElementById("searchInput");
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnLimparFiltro = document.getElementById("btn-limpar-filtro");
const btnAtualizar = document.getElementById("btn-atualizar");
const tabelaBody = document.getElementById("tabela-custos-body");

/* ─── DATE HELPERS ─── */
function getStatusColor(status) {
  switch (status) {
    case "Criado":
      return "#6c757d";
    case "Recebido Parcialmente":
      return "#fd7e14";
    case "Recebido":
      return "#0d6efd";
    case "Cancelado":
      return "#dc3545";
    default:
      return "#000";
  }
}

/* ─── SET DEFAULT DATE RANGE (90 days) ─── */
function setDefaultDates() {
  const hoje = new Date();
  const noventaDiasAtras = new Date();
  noventaDiasAtras.setDate(hoje.getDate() - 90);
  dataFim.value = hoje.toISOString().split("T")[0];
  dataInicio.value = noventaDiasAtras.toISOString().split("T")[0];
}

/* ─── FETCH DATA ─── */
async function carregarDados() {
  const res = await fetch("http://localhost:3000/controle-custos");
  allRows = await res.json();
  renderTabela();
}

/* ─── RENDER ─── */
function renderTabela() {
  const search = searchInput.value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const inicio = dataInicio.value ? new Date(dataInicio.value) : null;
  const fim = dataFim.value ? new Date(dataFim.value + "T23:59:59") : null;

  const filtered = allRows.filter((row) => {
    if (inicio || fim) {
      const dataStr = row.data_pedido ? row.data_pedido.substring(0, 10) : null;

      if (dataStr) {
        const dataRef = new Date(dataStr + "T00:00:00");
        if (inicio && dataRef < inicio) return false;
        if (fim && dataRef > fim) return false;
      }
    }

    const searchable = [
      row.aplicacao,
      row.num_pedido,
      row.xNome,
      row.nNF,
      row.status_pedido,
      row.status_pagamento,
      row.tipo,
    ]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return searchable.includes(search);
  });

  tabelaBody.innerHTML = "";
  let totalValor = 0;
  const nfsUnicas = new Set();

  filtered.forEach((row) => {
    if (row.nf_id && !nfsUnicas.has(row.nf_id)) {
      nfsUnicas.add(row.nf_id);
      totalValor += row.valor_nf || 0;
    }
    // calculate data prevista style inside forEach where row is defined
    const dataPrevistaStyle = getDataPrevistaStyle(
      row.data_prevista,
      row.status_pedido,
      ["Recebido", "Cancelado"],
    );

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.aplicacao ?? "-"}</td>
      <td>
        <a href="../pages/formFornecedores.html?id=${row.pedido_id}" 
           target="_blank" style="color: #0d6efd; text-decoration: none;">
          ${row.num_pedido ?? "-"}
        </a>
      </td>
      <td>${row.xNome ?? "-"}</td>
      <td style="color: ${dataPrevistaStyle.cor};">${dataPrevistaStyle.texto}</td>
      <td>${
        row.nNF
          ? `<a href="../pages/editarNF.html?id=${row.nf_id}" 
        target="_blank"
        style="color: #0d6efd; text-decoration: none; font-weight: bold;">
       ${row.nNF}
     </a>`
          : "-"
      }</td>
      <td>${
        row.valor_nf
          ? row.valor_nf.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "-"
      }</td>
      <td>
        <span style="color: ${getStatusColor(row.status_pedido)}; font-weight: bold;">
          ${row.status_pedido ?? "-"}
        </span>
      </td>
      <td>-</td>
      <td>-</td>
      <td>
        <span style="color: ${row.status_pagamento === "Paga" ? "#198754" : "#dc3545"}; font-weight: bold;">
          ${row.status_pagamento ?? "-"}
        </span>
      </td>
    `;
    tabelaBody.appendChild(tr);
  });

  document.getElementById("total-registros").textContent = filtered.length;
  document.getElementById("total-valor").textContent =
    totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ─── EVENT LISTENERS ─── */
if (searchInput) searchInput.addEventListener("input", renderTabela);
if (dataInicio) dataInicio.addEventListener("change", renderTabela);
if (dataFim) dataFim.addEventListener("change", renderTabela);
if (btnAtualizar) btnAtualizar.addEventListener("click", carregarDados);
if (btnLimparFiltro) {
  btnLimparFiltro.addEventListener("click", () => {
    searchInput.value = "";
    setDefaultDates();
    renderTabela();
  });
}

/* ─── INIT ─── */
setDefaultDates();
carregarDados();
