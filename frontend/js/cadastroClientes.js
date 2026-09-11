/* ─── STATE ─── */
let clientes = [];
let selectedClienteId = null;

/* ─── ELEMENTS ─── */
const selectCliente = document.getElementById("selectCliente");
const btnCadastrar = document.getElementById("btn-cadastrar");
const btnAtualizar = document.getElementById("btn-atualizar");

/* ─── LOAD CLIENTES ─── */
async function carregarClientes() {
  const res = await fetch("http://localhost:3000/clientes");
  clientes = await res.json();
  clientes.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.razao_social;
    if (selectCliente) selectCliente.appendChild(option);
  });
}

/* ─── SELECT CLIENTE ─── */
if (selectCliente) {
  selectCliente.addEventListener("change", (e) => {
    const id = e.target.value;
    const cliente = clientes.find((c) => c.id == id);
    if (!cliente) return;

    selectedClienteId = cliente.id;
    document.getElementById("razaoSocialUpdate").value =
      cliente.razao_social ?? "";
    document.getElementById("cnpjUpdate").value =
      formatCNPJ(cliente.cnpj) ?? "";
    document.getElementById("ieUpdate").value = cliente.ie ?? "";
    document.getElementById("ruaUpdate").value = cliente.rua ?? "";
    document.getElementById("bairroUpdate").value = cliente.bairro ?? "";
    document.getElementById("cidadeUpdate").value = cliente.cidade ?? "";
    document.getElementById("estadoUpdate").value = cliente.estado ?? "";
    document.getElementById("cepUpdate").value = cliente.cep ?? "";
    document.getElementById("telefoneUpdate").value = cliente.telefone ?? "";
    document.getElementById("contatoUpdate").value = cliente.contato ?? "";
    document.getElementById("telefoneRepUpdate").value =
      cliente.telefone_rep ?? "";
    document.getElementById("emailClienteUpdate").value = cliente.email ?? "";
  });
}

/* ─── CADASTRAR ─── */
if (btnCadastrar) {
  btnCadastrar.addEventListener("click", async () => {
    const razaoSocial = document.getElementById("razaoSocial").value.trim();
    if (!razaoSocial) {
      alert("Por favor, informe a razão social.");
      return;
    }

    const payload = {
      razao_social: razaoSocial,
      cnpj: document.getElementById("cnpj").value,
      ie: document.getElementById("ie").value,
      rua: document.getElementById("rua").value,
      bairro: document.getElementById("bairro").value,
      cidade: document.getElementById("cidade").value,
      estado: document.getElementById("estado").value,
      cep: document.getElementById("cep").value,
      telefone: document.getElementById("telefone").value,
      contato: document.getElementById("contato").value,
      telefone_rep: document.getElementById("telefoneRep").value,
      email: document.getElementById("emailCliente").value,
    };

    const result = await fetch("http://localhost:3000/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      alert("Cliente cadastrado com sucesso!");
      // clear form
      [
        "razaoSocial",
        "cnpj",
        "ie",
        "rua",
        "bairro",
        "cidade",
        "estado",
        "cep",
        "telefone",
        "contato",
        "telefoneRep",
        "emailCliente",
      ].forEach((id) => {
        document.getElementById(id).value = "";
      });
    }
  });
}

/* ─── ATUALIZAR ─── */
if (btnAtualizar) {
  btnAtualizar.addEventListener("click", async () => {
    if (!selectedClienteId) {
      alert("Por favor, selecione um cliente.");
      return;
    }

    const payload = {
      razao_social: document.getElementById("razaoSocialUpdate").value,
      cnpj: document.getElementById("cnpjUpdate").value,
      ie: document.getElementById("ieUpdate").value,
      rua: document.getElementById("ruaUpdate").value,
      bairro: document.getElementById("bairroUpdate").value,
      cidade: document.getElementById("cidadeUpdate").value,
      estado: document.getElementById("estadoUpdate").value,
      cep: document.getElementById("cepUpdate").value,
      telefone: document.getElementById("telefoneUpdate").value,
      contato: document.getElementById("contatoUpdate").value,
      telefone_rep: document.getElementById("telefoneRepUpdate").value,
      email: document.getElementById("emailClienteUpdate").value,
    };

    const result = await fetch(
      `http://localhost:3000/clientes/${selectedClienteId}`,
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
      alert("Cliente atualizado com sucesso!");
    }
  });
}

/* ─── INIT ─── */
carregarClientes();
