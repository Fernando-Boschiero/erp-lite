/* ─── STATE ─── */
let nfData = null;
let pedidos = [];
let cotacoes = [];
let cotacoesSelecionadas = [];
const tiposComPedido = [
  "PC - Aluguel de Equipamento",
  "PC - Ativo",
  "PC - Benefícios",
  "PC - Carta de Correção",
  "PC - Complementar",
  "PC - Contas de Consumo",
  "PC - Consumível Fábrica",
  "PC - Consumível Pessoal",
  "PC - Demonstração",
  "PC - Despachante",
  "PC - Devolução",
  "PC - Embalagem",
  "PC - Entrada",
  "PC - Frete",
  "PC - Garantia",
  "PC - Industrialização",
  "PC - Manutenção",
  "PC - Matéria Prima",
  "PC - Material de Escritório",
  "PC - Medicina do Trabalho",
  "PC - Serviço",
  "PC - TI",
  "PC - Veículos",
];
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
const cotacaoSelect = document.getElementById("cotacaoSelect");
const btnAdicionarCotacao = document.getElementById("btn-adicionar-cotacao");
const cotacoesVinculadasDiv = document.getElementById("cotacoes-vinculadas");
const vinculoCotacao = document.getElementById("vinculo-cotacao");

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
  console.log("cotacao_id:", nfData.cotacao_id);
  console.log("cotacoes loaded:", cotacoes.length);
  const direcaoNF = document.getElementById("direcaoNF");
  if (direcaoNF) direcaoNF.value = nfData.direcao ?? "Entrada";

  pedidosSelecionados = (nfData.pedidosVinculados || []).map((p) => ({
    id: p.id,
    num_pedido: p.num_pedido,
    aplicacao: p.aplicacao,
    razao_social: p.razao_social,
  }));
  renderPedidosSelecionados();

  // populate cotacoesSelecionadas from cotacao_id
  if (nfData.cotacao_id) {
    const cotacao = cotacoes.find((c) => c.id == nfData.cotacao_id);
    if (cotacao) {
      cotacoesSelecionadas = [
        {
          id: cotacao.id,
          num_cotacao: cotacao.num_cotacao,
          cliente: cotacao.cliente,
        },
      ];
    }
    renderCotacoesSelecionadas();
  }

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

  // populate pedidosSelecionados from junction table
  // fall back to pedido_id if junction table has no entries
  if (nfData.pedidosVinculados && nfData.pedidosVinculados.length > 0) {
    pedidosSelecionados = nfData.pedidosVinculados.map((p) => ({
      id: p.id,
      num_pedido: p.num_pedido,
      aplicacao: p.aplicacao,
      razao_social: p.razao_social,
    }));
  } else if (nfData.pedido_id) {
    // fallback for NFs saved before junction table existed
    const pedido = pedidos.find((p) => p.id == nfData.pedido_id);
    if (pedido) {
      pedidosSelecionados = [
        {
          id: pedido.id,
          num_pedido: pedido.num_pedido,
          aplicacao: pedido.aplicacao,
          razao_social: pedido.razao_social,
        },
      ];
    }
  }
  renderPedidosSelecionados();

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
    tr.dataset.dupId = dup.id;
    tr.innerHTML = `
    <td><input type="text" class="dup-nDup" value="${dup.nDup ?? ""}" 
      style="width: 80px; border: 1px solid #dee2e6; border-radius: 4px; padding: 4px;" /></td>
    <td><input type="date" class="dup-dVenc" value="${dup.dVenc ?? ""}"
      style="border: 1px solid #dee2e6; border-radius: 4px; padding: 4px;" /></td>
    <td><input type="text" class="dup-vDup" 
      value="${dup.vDup ? dup.vDup.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""}"
      style="width: 100px; border: 1px solid #dee2e6; border-radius: 4px; padding: 4px;" /></td>
    <td style="color: ${dup.status === "Paga" ? "#198754" : "#dc3545"}; font-weight: bold;">
      ${dup.status ?? "-"}
    </td>
<td class="no-print">
  <button type="button" class="btn-deletar-duplicata" data-id="${dup.id}"
    style="background: none; border: none; cursor: pointer;">🗑️</button>
</td>
  `;
    dupBody.appendChild(tr);
  });

  const btnSalvarDuplicatas = document.getElementById("btn-salvar-duplicatas");

  if (btnSalvarDuplicatas) {
    btnSalvarDuplicatas.addEventListener("click", async () => {
      const rows = document.querySelectorAll("#duplicatas-body tr");
      let hasError = false;

      for (const row of rows) {
        const dupId = row.dataset.dupId;
        const nDup = row.querySelector(".dup-nDup")?.value;
        const dVenc = row.querySelector(".dup-dVenc")?.value;
        const vDupRaw = row.querySelector(".dup-vDup")?.value;
        const vDup =
          parseFloat(vDupRaw.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

        if (!dVenc) {
          alert(
            "Por favor, informe a data de vencimento de todas as duplicatas.",
          );
          hasError = true;
          break;
        }

        const result = await fetch(
          `http://localhost:3000/duplicatas/${dupId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nDup, dVenc, vDup }),
          },
        );

        const data = await result.json();
        if (!result.ok) {
          alert(data.error);
          hasError = true;
          break;
        }
      }

      if (!hasError) {
        alert("Duplicatas atualizadas com sucesso!");
        await carregarNF();
      }
    });
  }

  // delete handlers
  dupBody.querySelectorAll(".btn-deletar-duplicata").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja excluir esta duplicata?")) return;
      const result = await fetch(
        `http://localhost:3000/duplicatas/${btn.dataset.id}`,
        { method: "DELETE" },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        await carregarNF();
      }
    });
  });

  const statusDisplay = document.getElementById("statusPagamentoDisplay");
  const statusEdit = document.getElementById("statusPagamentoEdit");

  if (statusDisplay) {
    statusDisplay.value = nfData.status_pagamento ?? "Aberta";
    statusDisplay.style.color =
      nfData.status_pagamento === "Paga" ? "#198754" : "#dc3545";
    statusDisplay.style.fontWeight = "bold";
  }

  // show edit dropdown only if no duplicatas
  if (nfData.duplicatas && nfData.duplicatas.length === 0) {
    if (statusEdit) statusEdit.style.display = "block";
    if (statusPagamento)
      statusPagamento.value = nfData.status_pagamento ?? "Aberta";
  }

  const secaoAdicionarDup = document.getElementById(
    "secao-adicionar-duplicata",
  );
  if (secaoAdicionarDup) {
    if (nfData.direcao === "Sem valor financeiro") {
      secaoAdicionarDup.style.display = "none";
    } else {
      secaoAdicionarDup.style.display = "block";
    }
  }
}

// ADD button handler
const btnAdicionarDup = document.getElementById("btn-adicionar-duplicata");
if (btnAdicionarDup) {
  btnAdicionarDup.addEventListener("click", async () => {
    const nDup = document.getElementById("novaDupNumero").value || "001";
    const dVenc = document.getElementById("novaDupVenc").value;
    const vDupRaw = document.getElementById("novaDupValor").value;

    if (!dVenc) {
      alert("Por favor, informe a data de vencimento.");
      return;
    }

    // parse BR format value
    const vDup =
      parseFloat(vDupRaw.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

    const result = await fetch(
      `http://localhost:3000/notas-fiscais/${nfId}/duplicatas`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nDup, dVenc, vDup }),
      },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      alert("Data de vencimento adicionada com sucesso!");
      await carregarNF(); // reload to show new duplicata
    }
  });
}

/* ─── SHOW/HIDE PEDIDO/COTAÇÃO SECTION ─── */
function atualizarVinculo(tipo) {
  if (tiposComPedido.includes(tipo)) {
    vinculoPedido.style.display = "block";
    if (vinculoCotacao) vinculoCotacao.style.display = "none";
  } else if (tiposComCotacao.includes(tipo)) {
    vinculoPedido.style.display = "none";
    if (vinculoCotacao) vinculoCotacao.style.display = "block";
    pedidosSelecionados = [];
    renderPedidosSelecionados();
  } else {
    vinculoPedido.style.display = "none";
    if (vinculoCotacao) vinculoCotacao.style.display = "none";
    pedidosSelecionados = [];
    renderPedidosSelecionados();
  }
}

/* ─── EVENT LISTENERS ─── */
if (tipoNF) {
  tipoNF.addEventListener("change", () => {
    atualizarVinculo(tipoNF.value);
  });
}

let pedidosSelecionados = [];

const btnAdicionarPedido = document.getElementById("btn-adicionar-pedido");
const pedidosVinculadosDiv = document.getElementById("pedidos-vinculados");

function renderPedidosSelecionados() {
  if (!pedidosVinculadosDiv) return;
  pedidosVinculadosDiv.innerHTML = "";

  if (pedidosSelecionados.length === 0) {
    pedidosVinculadosDiv.innerHTML = `<p style="color:#6c757d;">Nenhum pedido vinculado.</p>`;
    return;
  }

  pedidosSelecionados.forEach((p) => {
    const div = document.createElement("div");
    div.style.cssText =
      "display:flex; align-items:center; gap:12px; padding:8px; border:1px solid #dee2e6; border-radius:4px; margin-bottom:6px; background:#f8f9fa;";
    div.innerHTML = `
      <span style="flex:1;"><strong>${p.num_pedido}</strong> — ${p.razao_social ?? ""} ${p.aplicacao ? `(${p.aplicacao})` : ""}</span>
      <button type="button" class="btn-remover-pedido" data-id="${p.id}"
        style="background:none; border:none; cursor:pointer; color:#dc3545;">✕</button>
    `;
    pedidosVinculadosDiv.appendChild(div);
  });

  pedidosVinculadosDiv
    .querySelectorAll(".btn-remover-pedido")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        pedidosSelecionados = pedidosSelecionados.filter(
          (p) => p.id != btn.dataset.id,
        );
        renderPedidosSelecionados();
      });
    });
}

if (btnAdicionarPedido) {
  btnAdicionarPedido.addEventListener("click", () => {
    const pedido = pedidos.find((p) => p.id == pedidoSelect.value);
    if (!pedido) return;
    if (pedidosSelecionados.find((p) => p.id == pedido.id)) {
      alert("Este pedido já foi adicionado.");
      return;
    }
    pedidosSelecionados.push(pedido);
    pedidoSelect.value = "";
    renderPedidosSelecionados();
  });
}

if (btnSalvar) {
  btnSalvar.addEventListener("click", async () => {
    if (!tipoNF.value) {
      alert("Por favor, selecione o tipo da nota fiscal.");
      return;
    }
    if (
      tiposComPedido.includes(tipoNF.value) &&
      pedidosSelecionados.length === 0
    ) {
      alert("Por favor, adicione pelo menos um pedido de compra.");
      return;
    }

    const payload = {
      tipo: tipoNF.value,
      pedido_ids: tiposComPedido.includes(tipoNF.value)
        ? pedidosSelecionados.map((p) => p.id)
        : [],
      cotacao_id: tiposComCotacao.includes(tipoNF.value)
        ? cotacoesSelecionadas[0]?.id || null
        : null,
      status_pagamento:
        nfData.duplicatas && nfData.duplicatas.length === 0
          ? statusPagamento.value
          : undefined,
      direcao: direcaoNF?.value || "Entrada",
      xNome: document.getElementById("xNome")?.value || "",
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

async function carregarCotacoes() {
  const res = await fetch("http://localhost:3000/cotacoes");
  cotacoes = await res.json();
  cotacoes.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.num_cotacao} — ${c.cliente}`;
    if (cotacaoSelect) cotacaoSelect.appendChild(option);
  });
}

function renderCotacoesSelecionadas() {
  if (!cotacoesVinculadasDiv) return;
  cotacoesVinculadasDiv.innerHTML = "";

  if (cotacoesSelecionadas.length === 0) {
    cotacoesVinculadasDiv.innerHTML = `<p style="color:#6c757d;">Nenhuma cotação vinculada.</p>`;
    return;
  }

  cotacoesSelecionadas.forEach((c) => {
    const div = document.createElement("div");
    div.style.cssText =
      "display:flex; align-items:center; gap:12px; padding:8px; border:1px solid #dee2e6; border-radius:4px; margin-bottom:6px; background:#f8f9fa;";
    div.innerHTML = `
      <span style="flex:1;"><strong>${c.num_cotacao}</strong> — ${c.cliente}</span>
      <button type="button" class="btn-remover-cotacao" data-id="${c.id}"
        style="background:none; border:none; cursor:pointer; color:#dc3545;">✕</button>
    `;
    cotacoesVinculadasDiv.appendChild(div);
  });

  cotacoesVinculadasDiv
    .querySelectorAll(".btn-remover-cotacao")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        cotacoesSelecionadas = cotacoesSelecionadas.filter(
          (c) => c.id != btn.dataset.id,
        );
        renderCotacoesSelecionadas();
      });
    });
}

if (btnAdicionarCotacao) {
  btnAdicionarCotacao.addEventListener("click", () => {
    const cotacao = cotacoes.find((c) => c.id == cotacaoSelect.value);
    if (!cotacao) return;
    if (cotacoesSelecionadas.find((c) => c.id == cotacao.id)) {
      alert("Esta cotação já foi adicionada.");
      return;
    }
    cotacoesSelecionadas.push(cotacao);
    cotacaoSelect.value = "";
    renderCotacoesSelecionadas();
  });
}

/* ─── INIT ─── */
if (!nfId) {
  alert("Nota fiscal não encontrada.");
} else {
  Promise.all([carregarPedidos(), carregarCotacoes()]).then(() => carregarNF());
}
