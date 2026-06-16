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
  document.getElementById("contato").value = "";
  document.getElementById("telefoneRep").value = "";
  document.getElementById("emailFornecedor").value = "";
}

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
    document.getElementById("contato").value = findFornecedor.contato ?? "";
    document.getElementById("telefoneRep").value =
      findFornecedor.telefone_rep ?? "";
    document.getElementById("emailFornecedor").value =
      findFornecedor.email ?? "";
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
      contato: document.getElementById("contato").value,
      telefone_rep: document.getElementById("telefoneRep").value,
      email: document.getElementById("emailFornecedor").value,
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
        clearForm();
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
