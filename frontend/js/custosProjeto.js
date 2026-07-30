/* ─── STATE ─── */
let barChart = null;

/* ─── ELEMENTS ─── */
const dataInicio = document.getElementById("dataInicio");
const dataFim = document.getElementById("dataFim");
const filtroAplicacao = document.getElementById("filtroAplicacao");
const btnAtualizar = document.getElementById("btn-atualizar");
const btnPdf = document.getElementById("btn-pdf");
const tabelaProjetos = document.getElementById("tabela-projetos");

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

/* ─── SET DEFAULT DATES (last 12 months) ─── */
function setDefaultDates() {
  const hoje = new Date();
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(hoje.getFullYear() - 1);
  dataFim.value = hoje.toISOString().split("T")[0];
  dataInicio.value = umAnoAtras.toISOString().split("T")[0];
}

/* ─── FETCH AND RENDER ─── */
async function carregarCustos() {
  const params = new URLSearchParams({
    inicio: dataInicio.value,
    fim: dataFim.value,
    aplicacao: filtroAplicacao.value,
  });

  const res = await fetch(
    `http://localhost:3000/relatorios/custos-projeto?${params}`,
  );
  const data = await res.json();

  // populate aplicacao dropdown
  filtroAplicacao.innerHTML = `<option value="Todos">Todos os Projetos</option>`;
  data.aplicacoes.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    if (filtroAplicacao.dataset.selected === a) opt.selected = true;
    filtroAplicacao.appendChild(opt);
  });

  // KPI cards
  document.getElementById("total-geral").textContent = formatBRL(
    data.totalGeral,
  );
  document.getElementById("total-pago").textContent = formatBRL(data.totalPago);
  document.getElementById("total-aberto").textContent = formatBRL(
    data.totalAberto,
  );

  // bar chart
  if (barChart) barChart.destroy();
  const colors = [
    "#1a5c35",
    "#2e8b57",
    "#0d6efd",
    "#fd7e14",
    "#dc3545",
    "#6610f2",
    "#20c997",
    "#ffc107",
    "#0dcaf0",
    "#6c757d",
  ];
  barChart = new Chart(document.getElementById("chart-bar"), {
    type: "bar",
    data: {
      labels: data.chartData.map((p) => p.aplicacao),
      datasets: [
        {
          label: "Custo Total",
          data: data.chartData.map((p) => p.total),
          backgroundColor: data.chartData.map(
            (_, i) => colors[i % colors.length],
          ),
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
            label: (ctx) => `Custo: ${formatBRL(ctx.raw)}`,
          },
        },
        legend: { display: false },
      },
      scales: {
        y: {
          ticks: { callback: (val) => formatBRL(val) },
        },
        x: {
          ticks: {
            maxRotation: 30,
            callback: function (val) {
              const label = this.getLabelForValue(val);
              return label.length > 20 ? label.substring(0, 20) + "..." : label;
            },
          },
        },
      },
    },
  });

  // tables by project
  tabelaProjetos.innerHTML = "";

  if (data.porProjeto.length === 0) {
    tabelaProjetos.innerHTML = `<div class="chart-card" style="text-align:center; color:#6c757d; padding:32px;">
      Nenhum dado encontrado para o período selecionado.
    </div>`;
    return;
  }

  data.porProjeto.forEach((proj) => {
    const div = document.createElement("div");
    div.className = "chart-card";
    div.style.marginBottom = "16px";

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2 style="margin:0;">${proj.aplicacao}</h2>
        <div style="display:flex; gap:16px; font-size:0.85rem;">
          <span>Total: <strong style="color:#dc3545;">${formatBRL(proj.total)}</strong></span>
          <span>Pago: <strong style="color:#198754;">${formatBRL(proj.pago)}</strong></span>
          <span>Em Aberto: <strong style="color:#fd7e14;">${formatBRL(proj.aberto)}</strong></span>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead>
          <tr>
            <th class="th-relatorio">Vencimento</th>
            <th class="th-relatorio">NF</th>
            <th class="th-relatorio">Fornecedor</th>
            <th class="th-relatorio">Tipo</th>
            <th class="th-relatorio">Nº Dup.</th>
            <th class="th-relatorio">Valor</th>
            <th class="th-relatorio">Status</th>
          </tr>
        </thead>
        <tbody>
          ${proj.nfs
            .map(
              (nf, i) => `
            <tr style="background: ${i % 2 === 0 ? "#f8f9fa" : "white"};">
              <td class="td-relatorio">${formatarData(nf.dVenc)}</td>
              <td class="td-relatorio">
                <a href="../pages/editarNF.html?id=${nf.nf_id}" target="_blank"
                  style="color:#0d6efd; text-decoration:none;">
                  ${nf.nNF && !nf.nNF.startsWith("MANUAL-") ? nf.nNF : "Manual"}
                </a>
              </td>
              <td class="td-relatorio">${nf.xNome ?? "-"}</td>
              <td class="td-relatorio">${nf.tipo ?? "-"}</td>
              <td class="td-relatorio">${nf.nDup ?? "-"}</td>
              <td class="td-relatorio negative">${formatBRL(nf.vDup)}</td>
              <td class="td-relatorio">
                <span style="color:${nf.status === "Paga" ? "#198754" : "#fd7e14"}; font-weight:600;">
                  ${nf.status}
                </span>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
    tabelaProjetos.appendChild(div);
  });
}

/* ─── PDF EXPORT ─── */
if (btnPdf) {
  btnPdf.addEventListener("click", () => window.print());
}

/* ─── EVENT LISTENERS ─── */
if (btnAtualizar) btnAtualizar.addEventListener("click", carregarCustos);
if (dataInicio) dataInicio.addEventListener("change", carregarCustos);
if (dataFim) dataFim.addEventListener("change", carregarCustos);
if (filtroAplicacao) {
  filtroAplicacao.addEventListener("change", () => {
    filtroAplicacao.dataset.selected = filtroAplicacao.value;
    carregarCustos();
  });
}

/* ─── INIT ─── */
setDefaultDates();
carregarCustos();
