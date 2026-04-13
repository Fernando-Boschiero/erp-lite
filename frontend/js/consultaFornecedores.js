/* CONSULTA */
const inputBusca = document.getElementById("busca");
const resultadoBusca = document.getElementById("resultado-busca");

function normalizarTexto(texto) {
  return (
    texto
      ?.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? ""
  );
}

function renderizarTabela(lista) {
  resultadoBusca.innerHTML = "";
  if (lista.length === 0) {
    resultadoBusca.innerHTML = `<tr><td colspan="10">Nenhum fornecedor encontrado.</td></tr>`;
    return;
  }
  lista.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.razao_social}</td>
      <td>${formatCNPJ(f.cnpj)}</td>
      <td>${f.rua}</td>
      <td>${f.bairro}</td>
      <td>${f.cidade}</td>
      <td>${f.estado}</td>
      <td>${f.cep}</td>
      <td>${f.telefone}</td>
      <td>
        <select class="toggle-ativo" data-id="${f.id}">
          <option value="1" ${f.is_active == 1 ? "selected" : ""}>Ativo</option>
          <option value="0" ${f.is_active == 0 ? "selected" : ""}>Inativo</option>
        </select>
      </td>
      <td><span class="delete-icon" data-id="${f.id}">🗑️</span></td>
    `;
    resultadoBusca.appendChild(tr);
  });
  applyColumnVisibility();
}

const columnToggles = document.querySelectorAll(
  "#column-toggles input[type='checkbox']",
);

function applyColumnVisibility() {
  columnToggles.forEach((checkbox) => {
    const colIndex = parseInt(checkbox.dataset.column);
    const isVisible = checkbox.checked;
    document.querySelectorAll("#tabela-fornecedores thead tr th")[
      colIndex
    ].style.display = isVisible ? "" : "none";
    document.querySelectorAll("#resultado-busca tr").forEach((row) => {
      if (row.cells[colIndex])
        row.cells[colIndex].style.display = isVisible ? "" : "none";
    });
  });
}

columnToggles.forEach((checkbox) => {
  checkbox.addEventListener("change", applyColumnVisibility);
});

resultadoBusca.addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-icon")) {
    const id = e.target.dataset.id;
    if (!confirm("Tem certeza que deseja excluir este fornecedor?")) return;
    await fetch(`http://localhost:3000/fornecedores/${id}`, {
      method: "DELETE",
    });
    await carregarFornecedores();
    renderizarTabela(fornecedores);
  }
});

resultadoBusca.addEventListener("change", async (e) => {
  if (e.target.classList.contains("toggle-ativo")) {
    const id = e.target.dataset.id;
    const isActive = e.target.value;
    await fetch(`http://localhost:3000/fornecedores/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    });
  }
});

function buscarFornecedor(termo) {
  const termoNormalizado = normalizarTexto(termo);
  if (!termoNormalizado) {
    renderizarTabela(fornecedores);
    return;
  }
  const resultado = fornecedores.filter(
    (f) =>
      normalizarTexto(f.razao_social).includes(termoNormalizado) ||
      normalizarTexto(f.cnpj).includes(termoNormalizado) ||
      normalizarTexto(f.rua).includes(termoNormalizado) ||
      normalizarTexto(f.bairro).includes(termoNormalizado) ||
      normalizarTexto(f.cidade).includes(termoNormalizado) ||
      normalizarTexto(f.estado).includes(termoNormalizado) ||
      normalizarTexto(f.cep).includes(termoNormalizado) ||
      normalizarTexto(f.telefone).includes(termoNormalizado) ||
      normalizarTexto(f.is_active).includes(termoNormalizado),
  );
  renderizarTabela(resultado);
}

if (inputBusca) {
  inputBusca.addEventListener("input", (e) => buscarFornecedor(e.target.value));
}

carregarFornecedores().then((dados) => {
  renderizarTabela(dados);
});
