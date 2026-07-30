/* ─── STATE ─── */
let barChart = null;
let lineChart = null;

/* ─── ELEMENTS ─── */
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const btnAtualizar = document.getElementById("btn-atualizar");
const btnPdf = document.getElementById("btn-pdf");

/* ─── HELPERS ─── */
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMes(mesStr) {
  const [ano, mes] = mesStr.split("-");
  const nomes = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${nomes[parseInt(mes) - 1]}/${ano}`;
}

/* ─── SET DEFAULT DATE RANGE (6 months) ─── */
function setDefaultDates() {
  const hoje = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(hoje.getMonth() - 5);
  dataFim.value = hoje.toISOString().split("T")[0];
  dataInicio.value = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
}

/* ─── FETCH AND RENDER ─── */
async function carregarFluxo() {
  const res = await fetch(
    `http://localhost:3000/relatorios/fluxo-caixa?inicio=${dataInicio.value}&fim=${dataFim.value}`,
  );
  const data = await res.json();

  if (!data.length) {
    document.getElementById("tabela-fluxo-body").innerHTML =
      `<tr><td colspan="7" style="padding:16px; text-align:center; color:#6c757d;">Nenhum dado encontrado para o período selecionado.</td></tr>`;
    return;
  }

  // totals
  const totalEntradas = data.reduce((s, m) => s + m.entradaTotal, 0);
  const totalSaidas = data.reduce((s, m) => s + m.saidaTotal, 0);
  const saldoPeriodo = totalEntradas - totalSaidas;

  document.getElementById("total-entradas").textContent =
    formatBRL(totalEntradas);
  document.getElementById("total-saidas").textContent = formatBRL(totalSaidas);
  document.getElementById("saldo-periodo").textContent =
    formatBRL(saldoPeriodo);

  const cardSaldo = document.getElementById("card-saldo-periodo");
  cardSaldo.className = `kpi-card ${saldoPeriodo >= 0 ? "success" : "danger"}`;

  const labels = data.map((m) => formatMes(m.mes));

  // bar chart
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById("chart-bar"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Entradas",
          data: data.map((m) => m.entradaTotal),
          backgroundColor: "rgba(13, 110, 253, 0.7)",
          borderColor: "#0d6efd",
          borderWidth: 1,
        },
        {
          label: "Saídas",
          data: data.map((m) => m.saidaTotal),
          backgroundColor: "rgba(220, 53, 69, 0.7)",
          borderColor: "#dc3545",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}`,
          },
        },
        legend: { position: "top" },
      },
      scales: {
        y: {
          ticks: { callback: (val) => formatBRL(val) },
        },
      },
    },
  });

  // line chart - saldo acumulado
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById("chart-line"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Saldo Acumulado",
          data: data.map((m) => m.saldoAcumulado),
          borderColor: "#1a5c35",
          backgroundColor: "rgba(26, 92, 53, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: data.map((m) =>
            m.saldoAcumulado >= 0 ? "#198754" : "#dc3545",
          ),
          pointRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `Saldo: ${formatBRL(ctx.raw)}`,
          },
        },
        legend: { display: false },
      },
      scales: {
        y: {
          ticks: { callback: (val) => formatBRL(val) },
        },
      },
    },
  });

  // table
  const tbody = document.getElementById("tabela-fluxo-body");
  tbody.innerHTML = "";
  data.forEach((m, i) => {
    const tr = document.createElement("tr");
    tr.style.background = i % 2 === 0 ? "#f8f9fa" : "white";
    tr.innerHTML = `
      <td class="td-relatorio"><strong>${formatMes(m.mes)}</strong></td>
      <td class="td-relatorio positive">${formatBRL(m.entradasPagas)}</td>
      <td class="td-relatorio">${formatBRL(m.entradasAbertas)}</td>
      <td class="td-relatorio negative">${formatBRL(m.saidasPagas)}</td>
      <td class="td-relatorio">${formatBRL(m.saidasAbertas)}</td>
      <td class="td-relatorio ${m.saldoMes >= 0 ? "positive" : "negative"}">${formatBRL(m.saldoMes)}</td>
      <td class="td-relatorio ${m.saldoAcumulado >= 0 ? "positive" : "negative"}">${formatBRL(m.saldoAcumulado)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─── PDF EXPORT ─── */
if (btnPdf) {
  btnPdf.addEventListener("click", () => window.print());
}

/* ─── EVENT LISTENERS ─── */
if (btnAtualizar) btnAtualizar.addEventListener("click", carregarFluxo);
if (dataInicio) dataInicio.addEventListener("change", carregarFluxo);
if (dataFim) dataFim.addEventListener("change", carregarFluxo);

/* ─── INIT ─── */
setDefaultDates();
carregarFluxo();
