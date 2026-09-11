/* ─── STATE ─── */
let clientes = [];

/* ─── ELEMENTS ─── */
const searchInput = document.getElementById("searchInput");
const resultadoClientes = document.getElementById("resultado-clientes");

/* ─── FETCH ─── */
async function carregarClientes() {
  const res = await fetch("http://localhost:3000/clientes");
  clientes = await res.json();
  renderizarTabela(clientes);
}

/* ─── FILTER ─── */
function filtrarClientes() {
  const search = searchInput.value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const filtered = clientes.filter((c) => {
    const searchable = [c.razao_social, c.cnpj, c.cidade, c.contato, c.email]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return searchable.includes(search);
  });

  renderizarTabela(filtered);
}

/* ─── RENDER ─── */
function renderizarTabela(lista) {
  resultadoClientes.innerHTML = "";

  if (lista.length === 0) {
    resultadoClientes.innerHTML = `<tr><td colspan="14">Nenhum cliente encontrado.</td></tr>`;
    return;
  }

  lista.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.razao_social ?? "-"}</td>
      <td>${formatCNPJ(c.cnpj)}</td>
      <td>${c.ie ?? "-"}</td>
      <td>${c.rua ?? "-"}</td>
      <td>${c.bairro ?? "-"}</td>
      <td>${c.cidade ?? "-"}</td>
      <td>${c.estado ?? "-"}</td>
      <td>${c.cep ?? "-"}</td>
      <td>${c.telefone ?? "-"}</td>
      <td>${c.contato ?? "-"}</td>
      <td>${c.telefone_rep ?? "-"}</td>
      <td>${c.email ?? "-"}</td>
      <td>
        <select class="toggle-ativo" data-id="${c.id}">
          <option value="1" ${c.is_active == 1 ? "selected" : ""}>Ativo</option>
          <option value="0" ${c.is_active == 0 ? "selected" : ""}>Inativo</option>
        </select>
      </td>
      <td><span class="delete-icon" data-id="${c.id}">🗑️</span></td>
    `;
    resultadoClientes.appendChild(tr);
  });

  applyColumnVisibility();

  // toggle ativo
  resultadoClientes.querySelectorAll(".toggle-ativo").forEach((sel) => {
    sel.addEventListener("change", async () => {
      await fetch(`http://localhost:3000/clientes/${sel.dataset.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: parseInt(sel.value) }),
      });
    });
  });

  // delete
  resultadoClientes.querySelectorAll(".delete-icon").forEach((icon) => {
    icon.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
      const result = await fetch(
        `http://localhost:3000/clientes/${icon.dataset.id}`,
        {
          method: "DELETE",
        },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        await carregarClientes();
      }
    });
  });
}

/* ─── COLUMN VISIBILITY ─── */
function applyColumnVisibility() {
  const checkboxes = document.querySelectorAll(
    "#column-toggles input[type='checkbox']",
  );
  checkboxes.forEach((cb) => {
    const colIndex = parseInt(cb.dataset.column);
    const cells = document.querySelectorAll(
      `#tabela-clientes thead tr th:nth-child(${colIndex + 1}),
       #tabela-clientes tbody tr td:nth-child(${colIndex + 1})`,
    );
    cells.forEach((cell) => {
      cell.style.display = cb.checked ? "" : "none";
    });
  });
}

/* ─── EVENT LISTENERS ─── */
if (searchInput) searchInput.addEventListener("input", filtrarClientes);

document
  .querySelectorAll("#column-toggles input[type='checkbox']")
  .forEach((cb) => {
    cb.addEventListener("change", applyColumnVisibility);
  });

/* ─── INIT ─── */
carregarClientes();
