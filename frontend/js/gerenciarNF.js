/* ─── STATE ─── */
let allNFs = [];

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
    ]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return searchable.includes(search);
  });

  tabelaBody.innerHTML = "";
  let totalValor = 0;

  filtered.forEach((nf) => {
    totalValor += nf.valor_nf || 0;
    const dataEmissao = nf.dhEmi
      ? new Date(nf.dhEmi).toLocaleDateString("pt-BR")
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="../pages/editarNF.html?id=${nf.id}"
           style="color: #0d6efd; text-decoration: none; font-weight: bold;">
          ${nf.nNF}
        </a>
      </td>
      <td>${dataEmissao}</td>
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
