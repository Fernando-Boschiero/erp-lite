/* ─── STATE ─── */
let barChart = null;
let donutChart = null;

/* ─── ELEMENTS ─── */
const mesFiltro = document.getElementById("mesFiltro");
const btnAtualizar = document.getElementById("btn-atualizar");
const btnPdf = document.getElementById("btn-pdf");

/* ─── HELPERS ─── */
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getMesAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/* ─── SET DEFAULT MONTH ─── */
mesFiltro.value = getMesAtual();

/* ─── FETCH AND RENDER ─── */
async function carregarKPI() {
  const mes = mesFiltro.value || getMesAtual();
  const res = await fetch(`http://localhost:3000/relatorios/kpi?mes=${mes}`);
  const data = await res.json();

  // KPI cards
  document.getElementById("kpi-a-pagar").textContent = formatBRL(data.aPagar);
  document.getElementById("kpi-a-receber").textContent = formatBRL(
    data.aReceber,
  );
  document.getElementById("kpi-vencido").textContent = formatBRL(data.vencido);
  document.getElementById("kpi-saldo").textContent = formatBRL(
    data.saldoProjetado,
  );

  // saldo card color
  const cardSaldo = document.getElementById("card-saldo");
  cardSaldo.className = `kpi-card ${data.saldoProjetado >= 0 ? "success" : "danger"}`;

  // bar chart
  const barLabels = data.ultimos6Meses.map((m) => m.mes);
  const barEntradas = data.ultimos6Meses.map((m) => m.entradas);
  const barSaidas = data.ultimos6Meses.map((m) => m.saidas);

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById("chart-bar"), {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [
        {
          label: "Entradas (Recebíveis)",
          data: barEntradas,
          backgroundColor: "rgba(13, 110, 253, 0.7)",
          borderColor: "#0d6efd",
          borderWidth: 1,
        },
        {
          label: "Saídas (Custos)",
          data: barSaidas,
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
          ticks: {
            callback: (val) => formatBRL(val),
          },
        },
      },
    },
  });

  // donut chart
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById("chart-donut"), {
    type: "doughnut",
    data: {
      labels: ["Em Aberto", "Pagas"],
      datasets: [
        {
          data: [data.donut.abertas, data.donut.pagas],
          backgroundColor: [
            "rgba(253, 126, 20, 0.8)",
            "rgba(25, 135, 84, 0.8)",
          ],
          borderColor: ["#fd7e14", "#198754"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatBRL(ctx.raw)}`,
          },
        },
        legend: { position: "bottom" },
      },
    },
  });
}

/* ─── PDF EXPORT ─── */
if (btnPdf) {
  btnPdf.addEventListener("click", () => {
    window.print();
  });
}

/* ─── EVENT LISTENERS ─── */
if (btnAtualizar) btnAtualizar.addEventListener("click", carregarKPI);
if (mesFiltro) mesFiltro.addEventListener("change", carregarKPI);

/* ─── INIT ─── */
carregarKPI();
