/* TABS */
const tabs = document.querySelectorAll("[data-tab-target]");
const tabContents = document.querySelectorAll("[data-tab-content]");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = document.querySelector(tab.dataset.tabTarget);
    tabContents.forEach((tabContent) => tabContent.classList.remove("active"));
    tabs.forEach((tab) => tab.classList.remove("active"));
    tab.classList.add("active");
    if (target) target.classList.add("active");
  });
});

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

  // apply current column visibility after rendering
  applyColumnVisibility();
}

const columnToggles = document.querySelectorAll(
  "#column-toggles input[type='checkbox']",
);

function applyColumnVisibility() {
  columnToggles.forEach((checkbox) => {
    const colIndex = parseInt(checkbox.dataset.column);
    const isVisible = checkbox.checked;

    // toggle header
    document.querySelectorAll("#tabela-fornecedores thead tr th")[
      colIndex
    ].style.display = isVisible ? "" : "none";

    // toggle cells in each row
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

/* CADASTRO / ATUALIZAÇÃO */
let currentMode = "register";
let selectedFornecedorId = null;

const selectFornecedor = document.getElementById("fornecedor");
const btnRegister = document.getElementById("btn-register");
const btnUpdate = document.getElementById("btn-update");
const btnSubmit = document.getElementById("btn-submit");
const selectContainer = document.getElementById("select-fornecedor-container");

function setMode(mode) {
  currentMode = mode;
  if (mode === "register") {
    btnRegister.classList.add("active-mode");
    btnUpdate.classList.remove("active-mode");
    selectContainer.style.display = "none";
    btnSubmit.textContent = "Cadastrar";
    clearForm();
    selectedFornecedorId = null;
  } else {
    btnUpdate.classList.add("active-mode");
    btnRegister.classList.remove("active-mode");
    selectContainer.style.display = "block";
    btnSubmit.textContent = "Atualizar";
    clearForm();
  }
}

function clearForm() {
  document.getElementById("cadastro-fornecedor").value = "";
  document.getElementById("cnpj").value = "";
  document.getElementById("ie").value = "";
  document.getElementById("rua").value = "";
  document.getElementById("bairro").value = "";
  document.getElementById("cidade").value = "";
  document.getElementById("estado").value = "";
  document.getElementById("cep").value = "";
  document.getElementById("telefone").value = "";
}

carregarFornecedores().then(() => {
  renderizarTabela(fornecedores);

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

    selectedFornecedorId = findFornecedor.id;
    document.getElementById("cadastro-fornecedor").value =
      findFornecedor.razao_social;
    document.getElementById("cnpj").value = formatCNPJ(findFornecedor.cnpj);
    document.getElementById("ie").value = findFornecedor.ie;
    document.getElementById("rua").value = findFornecedor.rua;
    document.getElementById("bairro").value = findFornecedor.bairro;
    document.getElementById("cidade").value = findFornecedor.cidade;
    document.getElementById("estado").value = findFornecedor.estado;
    document.getElementById("cep").value = findFornecedor.cep;
    document.getElementById("telefone").value = findFornecedor.telefone;
  });
}

if (btnRegister)
  btnRegister.addEventListener("click", () => setMode("register"));
if (btnUpdate) btnUpdate.addEventListener("click", () => setMode("update"));

if (btnSubmit) {
  btnSubmit.addEventListener("click", async () => {
    const payload = {
      razao_social: document.getElementById("cadastro-fornecedor").value,
      cnpj: document.getElementById("cnpj").value.replace(/\D/g, ""),
      ie: document.getElementById("ie").value,
      rua: document.getElementById("rua").value,
      bairro: document.getElementById("bairro").value,
      cidade: document.getElementById("cidade").value,
      estado: document.getElementById("estado").value,
      cep: document.getElementById("cep").value,
      telefone: document.getElementById("telefone").value,
    };

    if (currentMode === "register") {
      const result = await fetch("http://localhost:3000/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        alert("Fornecedor cadastrado com sucesso!");
      }
    } else {
      const result = await fetch(
        `http://localhost:3000/fornecedores/${selectedFornecedorId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        alert("Fornecedor atualizado com sucesso!");
      }
    }
  });
}
