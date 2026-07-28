/* ─── STATE ─── */
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let duplicatasDoMes = [];
let tooltipDupId = null;

/* ─── ELEMENTS ─── */
const calendarGrid = document.getElementById("calendar-grid");
const mesAnoDisplay = document.getElementById("mes-ano-display");
const btnMesAnterior = document.getElementById("btn-mes-anterior");
const btnMesProximo = document.getElementById("btn-mes-proximo");
const filterAbertas = document.getElementById("filter-abertas");
const filterPagas = document.getElementById("filter-pagas");
const tooltip = document.getElementById("dup-tooltip");
const tooltipContent = document.getElementById("tooltip-content");
const tooltipPagar = document.getElementById("tooltip-pagar");
const tooltipReabrir = document.getElementById("tooltip-reabrir");
const filterSaidas = document.getElementById("filter-saidas");

/* ─── FETCH DUPLICATAS ─── */
async function carregarDuplicatas() {
  const res = await fetch(
    `http://localhost:3000/duplicatas/calendario/${currentYear}/${currentMonth}`,
  );
  duplicatasDoMes = await res.json();
  renderCalendar();
}

/* ─── RENDER CALENDAR ─── */
function renderCalendar() {
  calendarGrid.innerHTML = "";

  // update header
  const nomesMeses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  mesAnoDisplay.textContent = `${nomesMeses[currentMonth - 1]} ${currentYear}`;

  // day headers
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  diasSemana.forEach((dia) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.textContent = dia;
    calendarGrid.appendChild(header);
  });

  // first day of month
  const primeiroDia = new Date(currentYear, currentMonth - 1, 1).getDay();
  const diasNoMes = new Date(currentYear, currentMonth, 0).getDate();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // empty cells before first day
  for (let i = 0; i < primeiroDia; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty";
    calendarGrid.appendChild(empty);
  }

  // filter duplicatas
  const showAbertas = filterAbertas.checked;
  const showPagas = filterPagas.checked;
  const showSaidas = filterSaidas ? filterSaidas.checked : true;

  // day cells
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    const dataCell = new Date(currentYear, currentMonth - 1, dia);
    if (dataCell.toDateString() === hoje.toDateString()) {
      cell.classList.add("today");
    }

    const dayNumber = document.createElement("div");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = dia;
    cell.appendChild(dayNumber);

    // find duplicatas for this day
    const diaStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const dups = duplicatasDoMes.filter((d) => d.dVenc === diaStr);

    dups.forEach((dup) => {
      if (dup.direcao === "Saída" && !showSaidas) return;
      if (dup.direcao !== "Saída" && dup.status === "Aberta" && !showAbertas)
        return;
      if (dup.direcao !== "Saída" && dup.status === "Paga" && !showPagas)
        return;

      const isSaida = dup.direcao === "Saída";
      const isVencida = dup.status === "Aberta" && dataCell < hoje;

      const entry = document.createElement("div");
      entry.className = `dup-entry ${
        isSaida
          ? "saida"
          : dup.status === "Paga"
            ? "paga"
            : isVencida
              ? "aberta vencida"
              : "aberta"
      }`;
      entry.textContent =
        "NF " +
        (dup.nNF.startsWith("MANUAL-") ? "Manual - " + dup.xNome : dup.nNF);
      entry.dataset.dupId = dup.id;

      // hover — show tooltip
      entry.addEventListener("mouseenter", (e) => {
        showTooltip(dup, e);
      });

      // click — open edit page in new tab
      entry.addEventListener("click", () => {
        window.open(`../pages/editarNF.html?id=${dup.nf_id}`, "_blank");
      });

      cell.appendChild(entry);
    });

    calendarGrid.appendChild(cell);
  }
}

/* ─── TOOLTIP ─── */
function showTooltip(dup, e) {
  tooltipDupId = dup.id;

  const isVencida =
    dup.status === "Aberta" && new Date(dup.dVenc + "T00:00:00") < new Date();
  const statusColor =
    dup.status === "Paga" ? "#198754" : isVencida ? "#dc3545" : "#856404";

  tooltipContent.innerHTML = `
  <div class="tooltip-row">
    <span class="tooltip-label">NF</span>
    <span class="tooltip-value">${dup.nNF.startsWith("MANUAL-") ? "Manual - " + dup.xNome : dup.nNF}</span>
  </div>
  <div class="tooltip-row">
    <span class="tooltip-label">Fornecedor</span>
    <span class="tooltip-value">${dup.xNome}</span>
  </div>
  <div class="tooltip-row">
    <span class="tooltip-label">Duplicata</span>
    <span class="tooltip-value">${dup.nDup}</span>
  </div>
  <div class="tooltip-row">
    <span class="tooltip-label">Valor</span>
    <span class="tooltip-value">${dup.vDup.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
  </div>
  <div class="tooltip-row">
    <span class="tooltip-label">Status</span>
    <span class="tooltip-value" style="color: ${statusColor}; font-weight: bold;">${dup.status}</span>
  </div>
  ${
    dup.data_pagamento
      ? `
  <div class="tooltip-row">
    <span class="tooltip-label">Pago em</span>
    <span class="tooltip-value">${new Date(dup.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
  </div>`
      : ""
  }
  ${
    dup.status === "Aberta"
      ? `
  <div class="tooltip-row" style="margin-top: 8px;">
    <span class="tooltip-label">Data pagamento</span>
    <input type="date" id="tooltip-data-pagamento" 
      value="${new Date().toISOString().split("T")[0]}"
      style="border: 1px solid #dee2e6; border-radius: 4px; padding: 2px 6px; font-size: 0.85rem;" />
  </div>`
      : ""
  }
`;

  // show appropriate action button
  if (dup.status === "Aberta") {
    tooltipPagar.style.display = "block";
    tooltipReabrir.style.display = "none";
  } else {
    tooltipPagar.style.display = "none";
    tooltipReabrir.style.display = "block";
  }

  // position tooltip near cursor
  tooltip.style.display = "block";
  const x = Math.min(e.clientX + 10, window.innerWidth - 320);
  const y = Math.min(e.clientY + 10, window.innerHeight - 200);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  tooltip.style.display = "none";
  tooltipDupId = null;
}

/* ─── MARK AS PAGA / REABRIR ─── */
if (tooltipPagar) {
  tooltipPagar.addEventListener("click", async () => {
    if (!tooltipDupId) return;
    const dateInput = document.getElementById("tooltip-data-pagamento");
    const dataPagamento = dateInput
      ? dateInput.value
      : new Date().toISOString().split("T")[0];

    const result = await fetch(
      `http://localhost:3000/duplicatas/${tooltipDupId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paga", data_pagamento: dataPagamento }),
      },
    );
    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      hideTooltip();
      await carregarDuplicatas();
    }
  });
}

if (tooltipReabrir) {
  tooltipReabrir.addEventListener("click", async () => {
    if (!tooltipDupId) return;
    const result = await fetch(
      `http://localhost:3000/duplicatas/${tooltipDupId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Aberta", data_pagamento: null }),
      },
    );
    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      hideTooltip();
      await carregarDuplicatas();
    }
  });
}

/* ─── CLOSE TOOLTIP ON OUTSIDE CLICK ─── */
document.addEventListener("click", (e) => {
  if (
    !tooltip.contains(e.target) &&
    !e.target.classList.contains("dup-entry")
  ) {
    hideTooltip();
  }
});

/* ─── EVENT LISTENERS ─── */
if (btnMesAnterior) {
  btnMesAnterior.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    carregarDuplicatas();
  });
}

if (btnMesProximo) {
  btnMesProximo.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    carregarDuplicatas();
  });
}

if (filterAbertas) filterAbertas.addEventListener("change", renderCalendar);
if (filterPagas) filterPagas.addEventListener("change", renderCalendar);
if (filterSaidas) filterSaidas.addEventListener("change", renderCalendar);

/* ─── INIT ─── */
document.addEventListener("DOMContentLoaded", () => {
  carregarDuplicatas();
});
