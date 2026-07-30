/* ─── ELEMENTS ─── */
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const filtroStatus = document.getElementById("filtroStatus");
const filtroDirecao = document.getElementById("filtroDirecao");
const btnAtualizar = document.getElementById("btn-atualizar");
const btnPdf = document.getElementById("btn-pdf");

/* ─── HELPERS ─── */
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(dateStr) {
  if (!dateStr) return "-";
  if (dateStr.includes("T"))
    return new Date(dateStr).toLocaleDateString("pt-BR");
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* ─── SET DEFAULT DATES (current month) ─── */
function setDefaultDates() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  dataInicio.value = inicio.toISOString().split("T")[0];
  dataFim.value = hoje.toISOString().split("T")[0];
}

/* ─── FETCH AND RENDER ─── */
async function carregarPagamentos() {
  const params = new URLSearchParams({
    inicio: dataInicio.value,
    fim: dataFim.value,
    status: filtroStatus.value,
    direcao: filtroDirecao.value,
  });

  const res = await fetch(
    `http://localhost:3000/relatorios/pagamentos?${params}`,
  );
  const data = await res.json();

  // KPI cards
  document.getElementById("total-aberto").textContent = formatBRL(
    data.totalAberto,
  );
  document.getElementById("total-pago").textContent = formatBRL(data.totalPago);
  document.getElementById("total-entradas").textContent = formatBRL(
    data.totalEntradas,
  );
  document.getElementById("total-saidas").textContent = formatBRL(
    data.totalSaidas,
  );

  document.getElementById("total-registros").textContent =
    `(${data.rows.length} registro${data.rows.length !== 1 ? "s" : ""})`;

  // table
  const tbody = document.getElementById("tabela-pagamentos-body");
  tbody.innerHTML = "";

  if (data.rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="padding:16px; text-align:center; color:#6c757d;">
      Nenhum registro encontrado para o período selecionado.
    </td></tr>`;
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  data.rows.forEach((row, i) => {
    const isVencida =
      row.status === "Aberta" && new Date(row.dVenc + "T00:00:00") < hoje;
    const isSaida = row.direcao === "Saída";

    const tr = document.createElement("tr");
    tr.style.background = i % 2 === 0 ? "#f8f9fa" : "white";
    tr.innerHTML = `
      <td class="td-relatorio" style="color: ${isVencida ? "#dc3545" : "inherit"}; font-weight: ${isVencida ? "600" : "normal"};">
        ${formatarData(row.dVenc)}${isVencida ? " ⚠️" : ""}
      </td>
      <td class="td-relatorio">
        <a href="../pages/editarNF.html?id=${row.nf_id}" target="_blank"
          style="color: #0d6efd; text-decoration: none;">
          ${row.nNF && !row.nNF.startsWith("MANUAL-") ? row.nNF : "Manual"}
        </a>
      </td>
      <td class="td-relatorio">${row.xNome ?? "-"}</td>
      <td class="td-relatorio">${row.tipo ?? "-"}</td>
      <td class="td-relatorio">
        <span style="color: ${isSaida ? "#0d6efd" : "#dc3545"}; font-weight: 600;">
          ${isSaida ? "↑ Entrada" : "↓ Saída"}
        </span>
      </td>
      <td class="td-relatorio">${row.nDup ?? "-"}</td>
      <td class="td-relatorio ${isSaida ? "positive" : "negative"}">${formatBRL(row.vDup)}</td>
      <td class="td-relatorio">
        <span style="color: ${row.status === "Paga" ? "#198754" : isVencida ? "#dc3545" : "#fd7e14"}; font-weight: 600;">
          ${row.status}
        </span>
      </td>
      <td class="td-relatorio">${formatarData(row.data_pagamento)}</td>
      <td class="td-relatorio">${row.num_pedido ?? "-"}</td>
      <td class="td-relatorio">${row.aplicacao ?? "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─── PDF EXPORT ─── */
if (btnPdf) {
  btnPdf.addEventListener("click", () => window.print());
}

/* ─── EVENT LISTENERS ─── */
if (btnAtualizar) btnAtualizar.addEventListener("click", carregarPagamentos);
if (dataInicio) dataInicio.addEventListener("change", carregarPagamentos);
if (dataFim) dataFim.addEventListener("change", carregarPagamentos);
if (filtroStatus) filtroStatus.addEventListener("change", carregarPagamentos);
if (filtroDirecao) filtroDirecao.addEventListener("change", carregarPagamentos);

/* ─── INIT ─── */
setDefaultDates();
carregarPagamentos();
