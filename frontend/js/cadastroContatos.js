/* ─── STATE ─── */
let contatos = [];
let clientes = [];
let selectedContatoId = null;

/* ─── ELEMENTS ─── */
const selectContato = document.getElementById("selectContato");
const btnCadastrar = document.getElementById("btn-cadastrar");
const btnAtualizar = document.getElementById("btn-atualizar");

/* ─── LOAD DATA ─── */
async function carregarDados() {
  const [resContatos, resClientes] = await Promise.all([
    fetch("http://localhost:3000/contatos"),
    fetch("http://localhost:3000/clientes"),
  ]);
  contatos = await resContatos.json();
  clientes = await resClientes.json();

  // populate cliente dropdowns
  ["clienteContato", "clienteContatoUpdate"].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    clientes.forEach((c) => {
      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = c.razao_social;
      sel.appendChild(option);
    });
  });

  // populate contato dropdown for update
  contatos.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.nome}${c.cliente_nome ? ` — ${c.cliente_nome}` : ""}`;
    if (selectContato) selectContato.appendChild(option);
  });
}

/* ─── SELECT CONTATO FOR UPDATE ─── */
if (selectContato) {
  selectContato.addEventListener("change", () => {
    const contato = contatos.find((c) => c.id == selectContato.value);
    if (!contato) return;
    selectedContatoId = contato.id;
    document.getElementById("nomeContatoUpdate").value = contato.nome ?? "";
    document.getElementById("emailContatoUpdate").value = contato.email ?? "";
    document.getElementById("telefoneContatoUpdate").value =
      contato.telefone ?? "";
    document.getElementById("clienteContatoUpdate").value =
      contato.cliente_id ?? "";
    document.getElementById("unidadeContatoUpdate").value =
      contato.unidade ?? "";
  });
}

/* ─── CADASTRAR ─── */
if (btnCadastrar) {
  btnCadastrar.addEventListener("click", async () => {
    const nome = document.getElementById("nomeContato").value.trim();
    if (!nome) {
      alert("Por favor, informe o nome do contato.");
      return;
    }

    const payload = {
      nome,
      email: document.getElementById("emailContato").value,
      telefone: document.getElementById("telefoneContato").value,
      cliente_id: document.getElementById("clienteContato").value || null,
      unidade: document.getElementById("unidadeContato").value,
    };

    const result = await fetch("http://localhost:3000/contatos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      alert("Contato cadastrado com sucesso!");
      [
        "nomeContato",
        "emailContato",
        "telefoneContato",
        "unidadeContato",
      ].forEach((id) => {
        document.getElementById(id).value = "";
      });
      document.getElementById("clienteContato").value = "";
    }
  });
}

/* ─── ATUALIZAR ─── */
if (btnAtualizar) {
  btnAtualizar.addEventListener("click", async () => {
    if (!selectedContatoId) {
      alert("Por favor, selecione um contato.");
      return;
    }

    const payload = {
      nome: document.getElementById("nomeContatoUpdate").value,
      email: document.getElementById("emailContatoUpdate").value,
      telefone: document.getElementById("telefoneContatoUpdate").value,
      cliente_id: document.getElementById("clienteContatoUpdate").value || null,
      unidade: document.getElementById("unidadeContatoUpdate").value,
    };

    const result = await fetch(
      `http://localhost:3000/contatos/${selectedContatoId}`,
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
      alert("Contato atualizado com sucesso!");
    }
  });
}

/* ─── INIT ─── */
carregarDados();
