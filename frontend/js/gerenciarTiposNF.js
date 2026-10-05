/* ─── STATE ─── */
let tipos = [];

/* ─── ELEMENTS ─── */
const novoTipoCategoria = document.getElementById("novoTipoCategoria");
const novoTipoDescricao = document.getElementById("novoTipoDescricao");
const btnAdicionarTipo = document.getElementById("btn-adicionar-tipo");
const resultadoTiposGeral = document.getElementById("resultado-tipos-geral");
const resultadoTiposPC = document.getElementById("resultado-tipos-pc");

/* ─── FETCH ─── */
async function carregarTipos() {
  const res = await fetch("http://localhost:3000/tipos-nf");
  tipos = await res.json();
  renderizarTabelas();
}

/* ─── RENDER ─── */
function renderizarTabelas() {
  const tiposGeral = tipos.filter((t) => t.categoria === "Geral");
  const tiposPC = tipos.filter((t) => t.categoria === "PC");
  const tiposCOT = tipos.filter((t) => t.categoria === "COT");

  renderizarTabela(tiposGeral, resultadoTiposGeral);
  renderizarTabela(tiposPC, resultadoTiposPC);
  renderizarTabela(tiposCOT, document.getElementById("resultado-tipos-cot"));
}

function renderizarTabela(lista, tbody) {
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="2">Nenhum tipo cadastrado.</td></tr>`;
    return;
  }

  lista.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.descricao}</td>
      <td><span class="delete-icon" data-id="${t.id}" data-descricao="${t.descricao}">🗑️</span></td>
    `;
    tbody.appendChild(tr);
  });

  // delete handlers
  tbody.querySelectorAll(".delete-icon").forEach((icon) => {
    icon.addEventListener("click", async () => {
      if (
        !confirm(
          `Atenção: Notas fiscais cadastradas com o tipo "${icon.dataset.descricao}" ficarão com o campo Tipo em branco. Deseja continuar?`,
        )
      )
        return;
      const result = await fetch(
        `http://localhost:3000/tipos-nf/${icon.dataset.id}`,
        {
          method: "DELETE",
        },
      );
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        await carregarTipos();
      }
    });
  });
}

/* ─── ADD TIPO ─── */
if (btnAdicionarTipo) {
  btnAdicionarTipo.addEventListener("click", async () => {
    const categoria = novoTipoCategoria.value;
    const descricaoBase = novoTipoDescricao.value.trim();

    if (!categoria) {
      alert("Por favor, selecione a categoria.");
      return;
    }
    if (!descricaoBase) {
      alert("Por favor, informe a descrição.");
      return;
    }

    // auto-prefix with category
    const descricao = `${categoria} - ${descricaoBase}`;

    const result = await fetch("http://localhost:3000/tipos-nf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao, categoria }),
    });

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      novoTipoDescricao.value = "";
      novoTipoCategoria.value = "";
      await carregarTipos();
    }
  });
}

/* ─── INIT ─── */
carregarTipos();
