/* ─── STATE ─── */
let nfData = null;
let pedidos = [];
const tiposComPedido = ["Frete", "Matéria Prima", "Serviço - Compra"];
const tiposComCotacao = ["Produto Acabado", "Serviço - Venda"];

/* ─── GET ID FROM URL ─── */
const urlParams = new URLSearchParams(window.location.search);
const nfId = urlParams.get("id");

/* ─── ELEMENTS ─── */
const tipoNF = document.getElementById("tipoNF");
const statusPagamento = document.getElementById("statusPagamento");
const pedidoSelect = document.getElementById("pedidoSelect");
const vinculoPedido = document.getElementById("vinculo-pedido");
const btnSalvar = document.getElementById("btn-salvar-nf");
const btnVoltar = document.getElementById("btn-voltar");

/* ─── LOAD PEDIDOS ─── */
async function carregarPedidos() {
  const res = await fetch("http://localhost:3000/pedidos");
  pedidos = await res.json();
  pedidos.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.num_pedido} — ${p.razao_social}`;
    pedidoSelect.appendChild(option);
  });
}

/* ─── LOAD NF DATA ─── */
async function carregarNF() {
  const res = await fetch(`http://localhost:3000/notas-fiscais/${nfId}`);
  nfData = await res.json();

  // fill read-only fields
  document.getElementById("nNF").value = nfData.nNF ?? "";
  document.getElementById("dhEmi").value = nfData.dhEmi
    ? new Date(nfData.dhEmi).toLocaleDateString("pt-BR")
    : "";
  document.getElementById("xNome").value = nfData.xNome ?? "";

  // fill editable fields
  tipoNF.value = nfData.tipo ?? "";
  statusPagamento.value = nfData.status_pagamento ?? "Aberta";

  // show/hide pedido section
  atualizarVinculo(nfData.tipo);

  // set pedido if linked
  if (nfData.pedido_id) {
    pedidoSelect.value = nfData.pedido_id;
    document.getElementById("fornecedorNF").value = nfData.razao_social ?? "";
    document.getElementById("aplicacaoNF").value = nfData.aplicacao ?? "";
  }

  // fill items table
  const itensBody = document.getElementById("itens-nf-body");
  itensBody.innerHTML = "";
  (nfData.itens || []).forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.xProd ?? "-"}</td>
      <td>${item.qCom ?? "-"}</td>
      <td>${item.uCom ?? "-"}</td>
      <td>${
        item.vUnCom
          ? item.vUnCom.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "-"
      }</td>
      <td>${
        item.vProd
          ? item.vProd.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "-"
      }</td>
    `;
    itensBody.appendChild(tr);
  });

  // fill duplicatas table
  const dupBody = document.getElementById("duplicatas-body");
  dupBody.innerHTML = "";
  (nfData.duplicatas || []).forEach((dup) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dup.nDup ?? "-"}</td>
      <td>${
        dup.dVenc
          ? new Date(dup.dVenc + "T00:00:00").toLocaleDateString("pt-BR")
          : "-"
      }</td>
      <td>${
        dup.vDup
          ? dup.vDup.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "-"
      }</td>
      <td style="color: ${dup.status === "Paga" ? "#198754" : "#dc3545"}; font-weight: bold;">
        ${dup.status ?? "-"}
      </td>
    `;
    dupBody.appendChild(tr);
  });
}

/* ─── SHOW/HIDE PEDIDO SECTION ─── */
function atualizarVinculo(tipo) {
  if (tiposComPedido.includes(tipo)) {
    vinculoPedido.style.display = "block";
  } else {
    vinculoPedido.style.display = "none";
    pedidoSelect.value = "";
    document.getElementById("fornecedorNF").value = "";
    document.getElementById("aplicacaoNF").value = "";
  }
}

/* ─── EVENT LISTENERS ─── */
if (tipoNF) {
  tipoNF.addEventListener("change", () => {
    atualizarVinculo(tipoNF.value);
  });
}

if (pedidoSelect) {
  pedidoSelect.addEventListener("change", () => {
    const pedido = pedidos.find((p) => p.id == pedidoSelect.value);
    if (!pedido) {
      document.getElementById("fornecedorNF").value = "";
      document.getElementById("aplicacaoNF").value = "";
      return;
    }
    document.getElementById("fornecedorNF").value = pedido.razao_social ?? "";
    document.getElementById("aplicacaoNF").value = pedido.aplicacao ?? "";
  });
}

if (btnSalvar) {
  btnSalvar.addEventListener("click", async () => {
    if (!tipoNF.value) {
      alert("Por favor, selecione o tipo da nota fiscal.");
      return;
    }
    if (tiposComPedido.includes(tipoNF.value) && !pedidoSelect.value) {
      alert("Por favor, selecione o pedido de compra relacionado.");
      return;
    }

    const payload = {
      tipo: tipoNF.value,
      pedido_id: tiposComPedido.includes(tipoNF.value)
        ? parseInt(pedidoSelect.value) || null
        : null,
      status_pagamento: statusPagamento.value,
    };

    const result = await fetch(`http://localhost:3000/notas-fiscais/${nfId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      alert("Nota fiscal atualizada com sucesso!");
      window.history.back();
    }
  });
}

if (btnVoltar) {
  btnVoltar.addEventListener("click", () => {
    window.history.back();
  });
}

/* ─── INIT ─── */
if (!nfId) {
  alert("Nota fiscal não encontrada.");
} else {
  carregarPedidos().then(() => carregarNF());
}
