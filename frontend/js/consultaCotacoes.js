const inputBusca = document.getElementById("busca");
const resultadoCotacoes = document.getElementById("resultado-cotacoes");
const btnNovaCotacao = document.getElementById("btn-nova-cotacao");
const btnRefresh = document.getElementById("btn-refresh");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");
const filtroDe = document.getElementById("filtroDe");
const filtroAte = document.getElementById("filtroAte");
const headerDataPrevista = document.getElementById("header-data-prevista");
/* MODAL VARIABLES */
const modalRevisoes = document.getElementById("modal-revisoes");
const btnFecharModal = document.getElementById("btn-fechar-modal");
const resultadoRevisoes = document.getElementById("resultado-revisoes");
const modalRevisoesTitulo = document.getElementById("modal-revisoes-titulo");

let cotacoes = [];
let sortDirection = 0; // 0 = original, 1 = ascending, -1 = descending

function normalizarTexto(texto) {
  return (
    texto
      ?.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? ""
  );
}

function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

function getStatusColor(status) {
  switch (status) {
    case "Criada":
      return "#6c757d";
    case "Em Análise Técnica":
      return "#fd7e14";
    case "Em Análise Financeira":
      return "#0d6efd";
    case "Enviado ao Cliente":
      return "#6610f2";
    case "Aceita":
      return "#198754";
    case "Pausada":
      return "#ffc107";
    case "Recusada":
      return "#dc3545";
    case "Cancelada":
      return "#343a40";
    default:
      return "#000";
  }
}

function getDataPrevistaStyle(dataPrevista, status) {
  // only gray out if truly closed
  if (["Recusada", "Cancelada"].includes(status)) {
    return { cor: "#000000", texto: dataPrevista || "-" };
  }

  if (!dataPrevista) return { cor: "#6c757d", texto: "-" };

  const [dia, mes, ano] = dataPrevista.split("/");
  const dataEntrega = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diffDias = Math.ceil((dataEntrega - hoje) / (1000 * 60 * 60 * 24));

  if (diffDias < 0)
    return { cor: "#dc3545", texto: `${dataPrevista} ⚠️ Atrasado` };
  if (diffDias <= 7)
    return { cor: "#fd7e14", texto: `${dataPrevista} (${diffDias}d)` };
  return { cor: "#198754", texto: `${dataPrevista} (${diffDias}d)` };
}

// set default 90 day period
function setDefaultPeriod() {
  const hoje = new Date();
  const noventaDiasAtras = new Date();
  noventaDiasAtras.setDate(hoje.getDate() - 90);

  filtroAte.value = hoje.toISOString().split("T")[0];
  filtroDe.value = noventaDiasAtras.toISOString().split("T")[0];
}

function applyFilters(lista) {
  const termo = normalizarTexto(inputBusca.value);
  const de = filtroDe.value ? new Date(filtroDe.value) : null;
  const ate = filtroAte.value ? new Date(filtroAte.value) : null;

  return lista.filter((c) => {
    // text search
    const matchTexto =
      !termo ||
      normalizarTexto(c.num_cotacao).includes(termo) ||
      normalizarTexto(c.cliente).includes(termo) ||
      normalizarTexto(c.status).includes(termo);

    // date range
    let matchData = true;
    if (c.data_cotacao) {
      const dataCotacao = new Date(c.data_cotacao);
      if (de && dataCotacao < de) matchData = false;
      if (ate && dataCotacao > ate) matchData = false;
    }

    // status
    return matchTexto && matchData;
  });
}

function applySort(lista) {
  if (sortDirection === 0) return lista;

  return [...lista].sort((a, b) => {
    if (!a.data_prevista && !b.data_prevista) return 0;
    if (!a.data_prevista) return 1;
    if (!b.data_prevista) return -1;

    const [diaA, mesA, anoA] = a.data_prevista.split("/");
    const [diaB, mesB, anoB] = b.data_prevista.split("/");
    const dateA = new Date(parseInt(anoA), parseInt(mesA) - 1, parseInt(diaA));
    const dateB = new Date(parseInt(anoB), parseInt(mesB) - 1, parseInt(diaB));

    return sortDirection === 1 ? dateA - dateB : dateB - dateA;
  });
}

async function carregarCotacoes() {
  const res = await fetch("http://localhost:3000/cotacoes");
  cotacoes = await res.json();
  console.log("cotacoes carregadas:", cotacoes);
  aplicarFiltrosEOrdenacao();
}

async function renderizarTabela(lista) {
  resultadoCotacoes.innerHTML = "";

  if (lista.length === 0) {
    resultadoCotacoes.innerHTML = `
      <tr><td colspan="8">Nenhuma cotação encontrada.</td></tr>
    `;
    return;
  }

  for (const c of lista) {
    const res = await fetch(`http://localhost:3000/cotacoes/${c.id}`);
    const cotacao = await res.json();
    const total = (cotacao.itens || []).reduce(
      (sum, item) => sum + (item.total ?? 0),
      0,
    );
    const revisao = c.revisao == 0 ? "Rev.0" : `Rev.${c.revisao}`;
    const dataFormatada = formatarData(c.data_cotacao);
    const dataPrevistaStyle = getDataPrevistaStyle(c.data_prevista, c.status);

    const moedaCotacao = ["USD", "EUR", "BRL"].includes(c.moeda)
      ? c.moeda
      : "BRL";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.num_cotacao.toUpperCase()}</td>
      <td>${c.cliente}</td>
      <td>${dataFormatada}</td>
      <td>
        <span style="
          color: white;
          background: ${dataPrevistaStyle.cor};
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          white-space: nowrap;
        ">${dataPrevistaStyle.texto}</span>
      </td>
      <td>${revisao}</td>
      <td>
        <span style="
          color: white;
          background: ${getStatusColor(c.status)};
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          white-space: nowrap;
        ">${c.status}</span>
      </td>
      <td>${total.toLocaleString("pt-BR", { style: "currency", currency: moedaCotacao })}</td>
        <button class="btn-editar" data-id="${c.id}">✏️ Editar</button>
        <button class="btn-pdf" data-id="${c.id}">📄 PDF</button>
          <button class="btn-revisoes" data-id="${c.id}" data-num="${c.num_cotacao}">📋 Revisões</button>
      </td>
    `;
    resultadoCotacoes.appendChild(tr);
  }
}

function aplicarFiltrosEOrdenacao() {
  const filtrado = applyFilters(cotacoes);
  const ordenado = applySort(filtrado);
  renderizarTabela(ordenado);
}

// sort on header click
if (headerDataPrevista) {
  headerDataPrevista.addEventListener("click", () => {
    if (sortDirection === 0) sortDirection = 1;
    else if (sortDirection === 1) sortDirection = -1;
    else sortDirection = 0;

    headerDataPrevista.textContent =
      sortDirection === 0
        ? "Data Prevista ↕"
        : sortDirection === 1
          ? "Data Prevista ↑"
          : "Data Prevista ↓";

    aplicarFiltrosEOrdenacao();
  });
}

// refresh button
if (btnRefresh) {
  btnRefresh.addEventListener("click", carregarCotacoes);
}

// clear filters
if (btnLimparFiltros) {
  btnLimparFiltros.addEventListener("click", () => {
    inputBusca.value = "";
    setDefaultPeriod();
    sortDirection = 0;
    if (headerDataPrevista) headerDataPrevista.textContent = "Data Prevista ↕";
    aplicarFiltrosEOrdenacao();
  });
}

// listen for filter changes
inputBusca?.addEventListener("input", aplicarFiltrosEOrdenacao);
filtroDe?.addEventListener("change", aplicarFiltrosEOrdenacao);
filtroAte?.addEventListener("change", aplicarFiltrosEOrdenacao);

// event delegation
resultadoCotacoes.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const id = e.target.dataset.id;
    window.open(`../pages/cotacao.html?id=${id}`, "_blank");
  }
  if (e.target.classList.contains("btn-pdf")) {
    const id = e.target.dataset.id;
    window.open(`http://localhost:3000/cotacoes/${id}/pdf`, "_blank");
  }
  if (e.target.classList.contains("btn-revisoes")) {
    const numCotacao = e.target.dataset.num;
    abrirModalRevisoes(numCotacao);
  }
});

if (btnNovaCotacao) {
  btnNovaCotacao.addEventListener("click", () => {
    window.open("../pages/cotacao.html", "_blank");
  });
}

/* ─── MODAL REVISÕES ─── */
async function abrirModalRevisoes(numCotacao) {
  modalRevisoesTitulo.textContent = `Histórico de Revisões — ${numCotacao}`;
  resultadoRevisoes.innerHTML = `<tr><td colspan="4">Carregando...</td></tr>`;
  modalRevisoes.style.display = "flex";

  const res = await fetch(
    `http://localhost:3000/cotacoes/${encodeURIComponent(numCotacao)}/revisoes`,
  );
  const revisoes = await res.json();

  resultadoRevisoes.innerHTML = "";

  if (revisoes.length === 0) {
    resultadoRevisoes.innerHTML = `<tr><td colspan="4">Nenhuma revisão encontrada.</td></tr>`;
    return;
  }

  // find the latest revision number
  const maxRevisao = Math.max(...revisoes.map((r) => r.revisao));

  revisoes.forEach((r) => {
    const isLatest = r.revisao === maxRevisao;
    const revisaoLabel = r.revisao === 0 ? "Rev.0" : `Rev.${r.revisao}`;
    const dataFormatada = formatarData(r.data_cotacao);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:8px; border-bottom:1px solid #eee;">
        ${revisaoLabel} ${isLatest ? '<span style="background:#198754; color:white; padding:1px 6px; border-radius:4px; font-size:0.75em;">atual</span>' : ""}
      </td>
      <td style="padding:8px; border-bottom:1px solid #eee;">${dataFormatada}</td>
      <td style="padding:8px; border-bottom:1px solid #eee;">
        <span style="
          color:white;
          background:${getStatusColor(r.status)};
          padding:2px 8px;
          border-radius:4px;
          font-size:0.85em;
        ">${r.status}</span>
      </td>
      <td style="padding:8px; border-bottom:1px solid #eee;">
        <button 
          class="btn-ver-revisao" 
          data-id="${r.id}"
          data-latest="${isLatest}">
          👁️ Ver
        </button>
        <button class="btn-pdf-revisao" data-id="${r.id}">📄 PDF</button>
      </td>
    `;
    resultadoRevisoes.appendChild(tr);
  });
}

// close modal
if (btnFecharModal) {
  btnFecharModal.addEventListener("click", () => {
    modalRevisoes.style.display = "none";
  });
}

// close modal when clicking outside
modalRevisoes?.addEventListener("click", (e) => {
  if (e.target === modalRevisoes) {
    modalRevisoes.style.display = "none";
  }
});

// handle revision buttons
resultadoRevisoes?.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-ver-revisao")) {
    const id = e.target.dataset.id;
    const isLatest = e.target.dataset.latest === "true";
    // open with readonly param if not the latest revision
    const url = isLatest
      ? `../pages/cotacao.html?id=${id}`
      : `../pages/cotacao.html?id=${id}&readonly=true`;
    window.open(url, "_blank");
  }

  if (e.target.classList.contains("btn-pdf-revisao")) {
    const id = e.target.dataset.id;
    window.open(`http://localhost:3000/cotacoes/${id}/pdf`, "_blank");
  }
});

// initialize
setDefaultPeriod();
carregarCotacoes();
