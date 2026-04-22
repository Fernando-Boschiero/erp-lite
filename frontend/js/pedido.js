/* ─── STATE ─── */
let currentPedidoId = null;

/* ─── ELEMENTS ─── */
const btnSalvarPedido = document.getElementById("btn-salvar-pedido");
const statusPedido = document.getElementById("statusPedido");
const statusSelect = document.getElementById("statusSelect");
const alteradoPor = document.getElementById("alteradoPor");
const observacaoStatus = document.getElementById("observacaoStatus");
const anexosSection = document.getElementById("anexos-section");
const btnUploadAnexo = document.getElementById("btn-upload-anexo");
const fileInput = document.getElementById("fileInput");
const listaAnexos = document.getElementById("lista-anexos");

/* ─── STATUS ─── */
const transicoesPermitidas = {
  Criado: ["Em Produção", "Cancelado"],
  "Em Produção": ["Entregue", "Cancelado"],
  Entregue: ["Faturado", "Cancelado"],
  Faturado: [],
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

function atualizarVisibilidadeAnexos(status) {
  const statusPermitidos = ["Em Produção", "Entregue", "Faturado"];
  anexosSection.style.display = statusPermitidos.includes(status)
    ? "block"
    : "none";
}

/* ─── COLLECT FORM DATA ─── */
function getItensFromTable() {
  const tableBody = document.querySelector("#itens-table tbody");
  return Array.from(tableBody.rows).map((row, index) => ({
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
    num_pedido: document.getElementById("numPedido")?.value || "",
    data_pedido: document.getElementById("dataPedido")?.value || "",
    fornecedor_id: document.getElementById("fornecedor")?.value || null,
    prazo_entrega: document.getElementById("prazoEntrega")?.value || "",
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
        atualizarVisibilidadeAnexos("Criado");
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
      atualizarVisibilidadeAnexos(statusNovo);
      alert(`Status alterado para "${statusNovo}" com sucesso!`);
    }
  });
}

/* ─── ATTACHMENTS ─── */
async function carregarAnexos() {
  if (!currentPedidoId) return;

  const res = await fetch(
    `http://localhost:3000/pedidos/${currentPedidoId}/anexos`,
  );
  const anexos = await res.json();

  listaAnexos.innerHTML = "";

  if (anexos.length === 0) {
    listaAnexos.innerHTML = `<p>Nenhum anexo adicionado.</p>`;
    return;
  }

  anexos.forEach((anexo) => {
    const div = document.createElement("div");
    div.className = "anexo-item";
    div.innerHTML = `
      <span>${anexo.nome_original}</span>
      <span style="font-size:0.8em; color:#666;">${(anexo.tamanho / 1024).toFixed(1)} KB</span>
      <a href="http://localhost:3000/pedidos/anexos/${anexo.id}" target="_blank">👁️ Ver</a>
      <button type="button" class="btn-deletar-anexo" data-id="${anexo.id}">🗑️</button>
    `;
    listaAnexos.appendChild(div);
  });
}

if (btnUploadAnexo) {
  btnUploadAnexo.addEventListener("click", async () => {
    if (!currentPedidoId) {
      alert("Salve o pedido antes de adicionar anexos.");
      return;
    }

    const file = fileInput.files[0];
    if (!file) {
      alert("Por favor, selecione um arquivo.");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);

    const result = await fetch(
      `http://localhost:3000/pedidos/${currentPedidoId}/anexos`,
      {
        method: "POST",
        body: formData,
      },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      fileInput.value = "";
      await carregarAnexos();
      alert("Anexo enviado com sucesso!");
    }
  });
}

if (listaAnexos) {
  listaAnexos.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-deletar-anexo")) {
      const id = e.target.dataset.id;
      if (!confirm("Tem certeza que deseja remover este anexo?")) return;

      const result = await fetch(`http://localhost:3000/pedidos/anexos/${id}`, {
        method: "DELETE",
      });

      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        await carregarAnexos();
      }
    }
  });
}

/* ─── LOAD EXISTING PEDIDO ─── */
async function carregarPedido(id) {
  const res = await fetch(`http://localhost:3000/pedidos/${id}`);
  const pedido = await res.json();

  document.getElementById("numPedido").value = pedido.num_pedido || "";
  document.getElementById("dataPedido").value = pedido.data_pedido || "";
  document.getElementById("prazoEntrega").value = pedido.prazo_entrega || "";
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
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td>${index + 1}</td>
      <td contenteditable="true" class="quantidade">${item.quantidade}</td>
      <td contenteditable="true">${item.descricao}</td>
      <td contenteditable="true">${item.unidade}</td>
      <td contenteditable="true" class="val-unitario">${item.val_unitario?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td contenteditable="true" class="ipi">${item.ipi}</td>
      <td>${item.total?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
    `;
    tableBody.appendChild(tr);
  });

  // set status
  statusPedido.value = pedido.status || "Criado";
  atualizarOpcoesStatus(pedido.status || "Criado");
  atualizarVisibilidadeAnexos(pedido.status || "Criado");

  // load attachments if applicable
  await carregarAnexos();
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

/* ─── ON LOAD ─── */
const urlParams = new URLSearchParams(window.location.search);
const pedidoIdFromUrl = urlParams.get("id");

if (pedidoIdFromUrl) {
  currentPedidoId = parseInt(pedidoIdFromUrl);
  // fornecedores are already loaded by formFornecedores.js
  // so we just wait for the DOM to be ready then load the pedido
  carregarFornecedores().then(() => {
    carregarPedido(currentPedidoId);
  });
} else {
  atualizarOpcoesStatus("Criado");
  atualizarVisibilidadeAnexos("Criado");
}
