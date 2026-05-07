const selectFornecedor = document.getElementById("fornecedor");

carregarFornecedores().then(() => {
  fornecedores.forEach((f) => {
    const option = document.createElement("option");
    option.value = f.id;
    option.textContent = f.razao_social;
    if (selectFornecedor) selectFornecedor.appendChild(option);
  });
});

if (selectFornecedor) {
  selectFornecedor.addEventListener("change", (e) => {
    const id = e.target.value;
    const findFornecedor = fornecedores.find((f) => f.id == id);
    if (!findFornecedor) return;

    document.getElementById("cnpj").value = formatCNPJ(findFornecedor.cnpj);
    document.getElementById("ie").value = findFornecedor.ie;
    document.getElementById("rua").value = findFornecedor.rua;
    document.getElementById("bairro").value = findFornecedor.bairro;
    document.getElementById("cidade").value = findFornecedor.cidade;
    document.getElementById("estado").value = findFornecedor.estado;
  });
}

/* JS PARA LIDAR COM INTERATIVIDADE DA TABELA (ADD, DELETE, SUM, ETC) */
const tableBody = document.querySelector("#itens-table tbody");
const addRowBtn = document.getElementById("add-row");
const deleteRowBtn = document.getElementById("delete-row");

const applyNumFormatting = (value, min = 0, fallback = "0") => {
  value = value
    .replace(/[^0-9.,]/g, "")
    .replace(/\./g, ",")
    .replace(/(,.*),/g, "$1");
  let num = parseFloat(value.replace(",", "."));
  if (isNaN(num) || num < min) return fallback;
  return num;
};

const parseBR = (value) => {
  if (!value) return 0;
  return (
    parseFloat(
      value
        .toString()
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    ) || 0
  );
};

const calcRow = (row) => {
  const qntText = row.querySelector(".quantidade")?.textContent || "0";
  const valText = row.querySelector(".val-unitario")?.textContent || "0";
  const ipiText = row.querySelector(".ipi")?.textContent || "0";

  const qnt = parseBR(qntText);
  const valUnit = parseBR(valText);
  const ipi = parseBR(ipiText);

  const base = qnt * valUnit;
  const total = base * (1 + ipi / 100);

  const cellTotal = row.cells[7];
  if (cellTotal) {
    cellTotal.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return total;
};

const calcTotalGeral = () => {
  let total = 0;
  Array.from(tableBody.rows).forEach((row) => {
    total += calcRow(row);
  });
  const campoTotal = document.getElementById("total-geral");
  campoTotal.textContent = total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

if (tableBody) {
  tableBody.addEventListener("focusout", (e) => {
    if (
      e.target.classList.contains("quantidade") ||
      e.target.classList.contains("ipi")
    ) {
      e.target.textContent = applyNumFormatting(
        e.target.textContent,
        0,
        "1",
      ).toLocaleString("pt-BR");
    }
    if (e.target.classList.contains("val-unitario")) {
      e.target.textContent = applyNumFormatting(
        e.target.textContent,
        0,
        "0",
      ).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
    const row = e.target.closest("tr");
    if (row) {
      calcRow(row);
      calcTotalGeral();
      console.log("rows in table:", tableBody.rows.length);
      Array.from(tableBody.rows).forEach((row, i) => {
        console.log(
          `row ${i} val-unitario:`,
          row.querySelector(".val-unitario")?.textContent,
        );
        console.log(
          `row ${i} quantidade:`,
          row.querySelector(".quantidade")?.textContent,
        );
      });
    }
  });
}

if (addRowBtn) {
  addRowBtn.addEventListener("click", () => {
    const rowCount = tableBody.rows.length + 1;
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td>${rowCount}</td>
      <td contenteditable="true" class="quantidade"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true" class="val-unitario"></td>
      <td contenteditable="true" class="ipi"></td>
      <td></td>
    `;
    tableBody.appendChild(newRow);
  });
}

if (deleteRowBtn) {
  deleteRowBtn.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll(".row-select:checked");
    checkboxes.forEach((cb) => cb.closest("tr").remove());
    Array.from(tableBody.rows).forEach((row, index) => {
      row.cells[1].textContent = index + 1;
    });
  });
}

if (tableBody) {
  tableBody.addEventListener("keydown", (e) => {
    const td = e.target.closest("td");
    if (!td) return;

    const tr = td.parentElement;
    const rowIndex = tr.rowIndex - 1;
    const cellIndex = td.cellIndex;
    let target;

    if (e.key === "ArrowRight") target = tr.cells[cellIndex + 1];
    if (e.key === "ArrowLeft") target = tr.cells[cellIndex - 1];
    if (e.key === "ArrowDown")
      target = tableBody.rows[rowIndex + 1]?.cells[cellIndex];
    if (e.key === "ArrowUp")
      target = tableBody.rows[rowIndex - 1]?.cells[cellIndex];

    if (target && target.hasAttribute("contenteditable")) {
      e.preventDefault();
      target.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(target);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
}
