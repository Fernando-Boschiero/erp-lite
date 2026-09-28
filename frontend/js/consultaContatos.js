/* ─── STATE ─── */
let contatos = [];

/* ─── ELEMENTS ─── */
const searchInput = document.getElementById("searchInput");
const resultadoContatos = document.getElementById("resultado-contatos");

/* ─── FETCH ─── */
async function carregarContatos() {
  const res = await fetch("http://localhost:3000/contatos");
  contatos = await res.json();
  renderizarTabela(contatos);
}

/* ─── FILTER ─── */
function filtrarContatos() {
  const search = searchInput.value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const filtered = contatos.filter((c) => {
    const searchable = [c.nome, c.email, c.telefone, c.cliente_nome, c.unidade]
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
  resultadoContatos.innerHTML = "";

  if (lista.length === 0) {
    resultadoContatos.innerHTML = `<tr><td colspan="6">Nenhum contato encontrado.</td></tr>`;
    return;
  }

  lista.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.nome ?? "-"}</td>
      <td>${c.email ?? "-"}</td>
      <td>${c.telefone ?? "-"}</td>
      <td>${c.cliente_nome ?? "-"}</td>
      <td>${c.unidade ?? "-"}</td>
      <td><span class="delete-icon" data-id="${c.id}">🗑️</span></td>
    `;
    resultadoContatos.appendChild(tr);
  });

  applyColumnVisibility();

  // delete
  resultadoContatos.querySelectorAll(".delete-icon").forEach((icon) => {
    icon.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja excluir este contato?")) return;
      const result = await fetch(
        `http://localhost:3000/contatos/${icon.dataset.id}`,
        {
          method: "DELETE",
        },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        await carregarContatos();
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
      `#tabela-contatos thead tr th:nth-child(${colIndex + 1}),
       #tabela-contatos tbody tr td:nth-child(${colIndex + 1})`,
    );
    cells.forEach((cell) => {
      cell.style.display = cb.checked ? "" : "none";
    });
  });
}

/* ─── EVENT LISTENERS ─── */
if (searchInput) searchInput.addEventListener("input", filtrarContatos);

document
  .querySelectorAll("#column-toggles input[type='checkbox']")
  .forEach((cb) => {
    cb.addEventListener("change", applyColumnVisibility);
  });

/* ─── INIT ─── */
carregarContatos();
