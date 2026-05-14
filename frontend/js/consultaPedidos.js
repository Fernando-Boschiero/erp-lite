const inputBusca = document.getElementById("busca");
const resultadoPedidos = document.getElementById("resultado-pedidos");
const btnNovoPedido = document.getElementById("btn-novo-pedido");
const btnRefresh = document.getElementById("btn-refresh");
const btnLimparFiltros = document.getElementById("btn-limpar-filtros");
const filtroDe = document.getElementById("filtroDe");
const filtroAte = document.getElementById("filtroAte");
const headerDataPrevista = document.getElementById("header-data-prevista");

let pedidos = [];
let sortDirection = 0;

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
    case "Criado":
      return "#6c757d";
    case "Enviado":
      return "#fd7e14";
    case "Entregue":
      return "#0d6efd";
    case "Faturado":
      return "#198754";
    case "Cancelado":
      return "#dc3545";
    default:
      return "#000";
  }
}

function getDataPrevistaStyle(dataPrevista, status) {
  if (["Faturado", "Cancelado", "Entregue"].includes(status)) {
    return { cor: "#6c757d", texto: dataPrevista || "-" };
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

  return lista.filter((p) => {
    const matchTexto =
      !termo ||
      normalizarTexto(p.num_pedido).includes(termo) ||
      normalizarTexto(p.razao_social).includes(termo) ||
      normalizarTexto(p.status).includes(termo);

    let matchData = true;
    if (p.data_pedido) {
      const dataPedido = new Date(p.data_pedido);
      if (de && dataPedido < de) matchData = false;
      if (ate && dataPedido > ate) matchData = false;
    }

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

async function carregarPedidos() {
  const res = await fetch("http://localhost:3000/pedidos");
  pedidos = await res.json();
  aplicarFiltrosEOrdenacao();
}

async function renderizarTabela(lista) {
  resultadoPedidos.innerHTML = "";

  if (lista.length === 0) {
    resultadoPedidos.innerHTML = `
      <tr><td colspan="7">Nenhum pedido encontrado.</td></tr>
    `;
    return;
  }

  for (const p of lista) {
    const res = await fetch(`http://localhost:3000/pedidos/${p.id}`);
    const pedido = await res.json();

    const total = (pedido.itens || []).reduce(
      (sum, item) => sum + (item.total ?? 0),
      0,
    );

    const dataFormatada = formatarData(p.data_pedido);
    const dataPrevistaStyle = getDataPrevistaStyle(p.data_prevista, p.status);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.num_pedido.toUpperCase()}</td>
      <td>${p.razao_social}</td>
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
      <td>
        <span style="
          color: white;
          background: ${getStatusColor(p.status)};
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          white-space: nowrap;
        ">${p.status}</span>
      </td>
      <td>${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>
        <button class="btn-editar" data-id="${p.id}">✏️ Editar</button>
        <button class="btn-pdf" data-id="${p.id}">📄 PDF</button>
      </td>
    `;
    resultadoPedidos.appendChild(tr);
  }
}

function aplicarFiltrosEOrdenacao() {
  const filtrado = applyFilters(pedidos);
  const ordenado = applySort(filtrado);
  renderizarTabela(ordenado);
}

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

if (btnRefresh) {
  btnRefresh.addEventListener("click", carregarPedidos);
}

if (btnLimparFiltros) {
  btnLimparFiltros.addEventListener("click", () => {
    inputBusca.value = "";
    setDefaultPeriod();
    sortDirection = 0;
    if (headerDataPrevista) headerDataPrevista.textContent = "Data Prevista ↕";
    aplicarFiltrosEOrdenacao();
  });
}

inputBusca?.addEventListener("input", aplicarFiltrosEOrdenacao);
filtroDe?.addEventListener("change", aplicarFiltrosEOrdenacao);
filtroAte?.addEventListener("change", aplicarFiltrosEOrdenacao);

resultadoPedidos.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const id = e.target.dataset.id;
    window.open(`../pages/formFornecedores.html?id=${id}`, "_blank");
  }
  if (e.target.classList.contains("btn-pdf")) {
    const id = e.target.dataset.id;
    window.open(`http://localhost:3000/pedidos/${id}/pdf`, "_blank");
  }
});

if (btnNovoPedido) {
  btnNovoPedido.addEventListener("click", () => {
    window.open("../pages/formFornecedores.html", "_blank");
  });
}

setDefaultPeriod();
carregarPedidos();
