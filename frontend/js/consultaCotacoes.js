const inputBusca = document.getElementById("busca");
const resultadoCotacoes = document.getElementById("resultado-cotacoes");
const btnNovaCotacao = document.getElementById("btn-nova-cotacao");

let cotacoes = [];

function normalizarTexto(texto) {
  return (
    texto
      ?.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? ""
  );
}

function getStatusColor(status) {
  switch (status) {
    case "Criada":
      return "#6c757d"; // gray
    case "Em Análise Técnica":
      return "#fd7e14"; // orange
    case "Em Análise Financeira":
      return "#0d6efd"; // blue
    case "Enviado ao Cliente":
      return "#198754"; // green
    default:
      return "#000";
    case "Aceita":
      return "#198754"; // green
    case "Pausada":
      return "#ffc107"; // yellow
    case "Recusada":
      return "#dc3545"; // red
    case "Cancelada":
      return "#6c757d"; // gray
  }
}

function calcTotalCotacao(itens) {
  return itens.reduce((sum, item) => sum + (item.total ?? 0), 0);
}

async function carregarCotacoes() {
  const res = await fetch("http://localhost:3000/cotacoes");
  cotacoes = await res.json();
  renderizarTabela(cotacoes);
}

function formatarData(dataStr) {
  if (!dataStr) return "-";
  const [ano, mes, dia] = dataStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function renderizarTabela(lista) {
  resultadoCotacoes.innerHTML = "";

  if (lista.length === 0) {
    resultadoCotacoes.innerHTML = `
      <tr><td colspan="7">Nenhuma cotação encontrada.</td></tr>
    `;
    return;
  }

  for (const c of lista) {
    // fetch itens to calculate total
    const res = await fetch(`http://localhost:3000/cotacoes/${c.id}`);
    const cotacao = await res.json();
    const total = calcTotalCotacao(cotacao.itens || []);
    const revisao = c.revisao == 0 ? "Rev.0" : `Rev.${c.revisao}`;
    const dataFormatada = formatarData(cotacao.data_cotacao);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.num_cotacao}</td>
      <td>${c.cliente}</td>
      <td>${dataFormatada}</td>
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
      <td>${total.toLocaleString("pt-BR", { style: "currency", currency: c.moeda === "USD" ? "USD" : "BRL" })}</td>
      <td>
        <button class="btn-editar" data-id="${c.id}">✏️ Editar</button>
        <button class="btn-pdf" data-id="${c.id}">📄 PDF</button>
      </td>
    `;
    resultadoCotacoes.appendChild(tr);
  }
}

function buscarCotacao(termo) {
  const termoNormalizado = normalizarTexto(termo);
  if (!termoNormalizado) {
    renderizarTabela(cotacoes);
    return;
  }
  const resultado = cotacoes.filter(
    (c) =>
      normalizarTexto(c.num_cotacao).includes(termoNormalizado) ||
      normalizarTexto(c.cliente).includes(termoNormalizado) ||
      normalizarTexto(c.status).includes(termoNormalizado) ||
      normalizarTexto(c.data_cotacao).includes(termoNormalizado),
  );
  renderizarTabela(resultado);
}

// event delegation for edit and PDF buttons
resultadoCotacoes.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const id = e.target.dataset.id;
    // opens cotacao.html with the id as a URL parameter
    window.open(`../pages/cotacao.html?id=${id}`, "_blank");
  }

  if (e.target.classList.contains("btn-pdf")) {
    const id = e.target.dataset.id;
    window.open(`http://localhost:3000/cotacoes/${id}/pdf`, "_blank");
  }
});

if (inputBusca) {
  inputBusca.addEventListener("input", (e) => buscarCotacao(e.target.value));
}

if (btnNovaCotacao) {
  btnNovaCotacao.addEventListener("click", () => {
    window.open("../pages/cotacao.html", "_blank");
  });
}

carregarCotacoes();
