const inputBusca = document.getElementById("busca");
const resultadoPedidos = document.getElementById("resultado-pedidos");
const btnNovoPedido = document.getElementById("btn-novo-pedido");

let pedidos = [];

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
    case "Criado":
      return "#6c757d"; // gray
    case "Em Produção":
      return "#fd7e14"; // orange
    case "Entregue":
      return "#0d6efd"; // blue
    case "Faturado":
      return "#198754"; // green
    case "Cancelado":
      return "#dc3545"; // red
    default:
      return "#000";
  }
}

async function carregarPedidos() {
  const res = await fetch("http://localhost:3000/pedidos");
  pedidos = await res.json();
  renderizarTabela(pedidos);
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

    function formatarData(dataStr) {
      if (!dataStr) return "-";
      const [ano, mes, dia] = dataStr.split("-");
      return `${dia}/${mes}/${ano}`;
    }
    const dataFormatada = formatarData(pedido.data_pedido);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.num_pedido}</td>
      <td>${p.razao_social}</td>
      <td>${dataFormatada}</td>
      <td>${p.prazo_entrega || "-"}</td>
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

function buscarPedido(termo) {
  const termoNormalizado = normalizarTexto(termo);
  if (!termoNormalizado) {
    renderizarTabela(pedidos);
    return;
  }
  const resultado = pedidos.filter(
    (p) =>
      normalizarTexto(p.num_pedido).includes(termoNormalizado) ||
      normalizarTexto(p.razao_social).includes(termoNormalizado) ||
      normalizarTexto(p.status).includes(termoNormalizado) ||
      normalizarTexto(p.prazo_entrega).includes(termoNormalizado),
  );
  renderizarTabela(resultado);
}

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

if (inputBusca) {
  inputBusca.addEventListener("input", (e) => buscarPedido(e.target.value));
}

if (btnNovoPedido) {
  btnNovoPedido.addEventListener("click", () => {
    window.open("../pages/formFornecedores.html", "_blank");
  });
}

carregarPedidos();
