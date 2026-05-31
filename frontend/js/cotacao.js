const responsavelSelectCotacao = document.getElementById("responsavelSelect");

// load usuarios into dropdown
carregarUsuarios().then(() => {
  usuarios.forEach((u) => {
    const option = document.createElement("option");
    option.value = u.id;
    option.textContent = u.nome;
    if (responsavelSelectCotacao) responsavelSelectCotacao.appendChild(option);
  });
});

// autofill fields when responsavel is selected
if (responsavelSelectCotacao) {
  responsavelSelectCotacao.addEventListener("change", () => {
    const usuario = usuarios.find(
      (u) => u.id == responsavelSelectCotacao.value,
    );
    if (!usuario) return;
    document.getElementById("comprador").value = usuario.nome;
    document.getElementById("compradorEmail").value = usuario.email;
    document.getElementById("compradorTelefone").value = usuario.telefone;
  });
}

// VARIAVEIS CALCULO DATA ENTREGA
const prazoEntregaCotacao = document.getElementById("prazoEntrega");
const dataAceite = document.getElementById("dataAceite");
const dataPrevistaCotacao = document.getElementById("dataPrevistaCotacao");

function calcularDataPrevistaCotacao() {
  const aceite = dataAceite?.value;
  const prazo = parseInt(prazoEntregaCotacao?.value);

  if (!aceite || isNaN(prazo)) {
    dataPrevistaCotacao.value = "";
    return;
  }

  const [ano, mes, dia] = aceite.split("-");
  const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  data.setDate(data.getDate() + prazo);

  const diaFormatado = String(data.getDate()).padStart(2, "0");
  const mesFormatado = String(data.getMonth() + 1).padStart(2, "0");
  const anoFormatado = data.getFullYear();

  dataPrevistaCotacao.value = `${diaFormatado}/${mesFormatado}/${anoFormatado}`;
}

// recalculate whenever either field changes
dataAceite?.addEventListener("input", calcularDataPrevistaCotacao);
prazoEntregaCotacao?.addEventListener("input", calcularDataPrevistaCotacao);

/* ─── QUILL EDITORS ─── */
const quillDescricao = new Quill("#editor-descricao", {
  theme: "snow",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["image", "link"],
      ["clean"],
    ],
  },
});

const quillCondicoes = new Quill("#editor-condicoes", {
  theme: "snow",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  },
});

const quillCondicoesGerais = new Quill("#editor-condicoes-gerais", {
  theme: "snow",
  modules: {
    toolbar: [
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["clean"],
    ],
  },
});

/* ─── BOILERPLATE - condições gerais de venda ─── */
// Pre-fills the condições gerais editor with standard legal text
const condicoesGeraisBoilerplate = `
<p><strong>INTRODUÇÃO:</strong> O presente documento tem o propósito de apresentar a Política associada ao fornecimento, crédito, garantia e assuntos relacionados à venda.</p>
<p><strong>1. CONDIÇÕES GERAIS:</strong> Esta venda está sujeita aos termos e condições especificados neste documento, bem como na proposta, pedido e/ou fatura fornecida pela VEIKON EQUIPAMENTOS E SERVIÇOS LTDA. ("VEIKON ENGENHARIA").</p>
<p>1.1. Não será aceita qualquer adição ou alteração promovida unilateralmente pelo cliente, de forma que qualquer declaração verbal ou escrita introduzida pelo mesmo não adicionará, alterará ou afetará sob qualquer forma os termos e condições estipulados.</p>
<p>1.2. Todos os pedidos devem ser transmitidos de maneira formal, através de fax ou e-mail, a fim de evitar erros e transtornos na confecção e entrega do material, estando sujeitos a análise prévia e aceite da VEIKON ENGENHARIA. O pedido deve conter as informações a seguir: Arquivo scaneado da proposta com todas as páginas rubricadas, nome, telefone e carimbo do comprador ou responsável pela solicitação.  endereço de entrega, endereço de cobrança, endereço de faturamento com respectivo CNPJ e I.E, utilização (consumo ou industrialização), Incoterm (CIF, FOB,EXW), transportadora (para quem utiliza), preço, prazo de pagamento negociado e quantidade desejada. O valor de faturamento mínimo é de R$ 250,00 (duzentos e cinquenta reais). Prazo para faturamento a ser negociado em cada caso, sempre mediante aprovação de cadastro.</p>
<p>1.3. Os preços dos produtos obedecerão à tabela da VEIKON ENGENHARIA, que poderá alterá-los a qualquer tempo desde que avise o cliente durante o prazo de validade da proposta e antes da efetivação do pedido, ficando desde já estabelecido que os preços incluem tributos incidentes sobre a venda, circulação de mercadoria e impostos e/ou tarifas alfandegárias. O custo da embalagem também está incluso nos valores dos produtos e o despacho será feito pela área de transporte após sinalização da produção e a emissão da Nota Fiscal. A menos que especificado de forma diversa na proposta, o frete para entrega em território brasileiro será por conta do cliente.</p>
<p>1.4. A menos que especificado de forma diversa, o pagamento das faturas referentes aos produtos deverá ser efetuado em moeda corrente brasileira, e a entrega da mercadoria será feita na fábrica da VEIKON ENGENHARIA, localizada na Rua Joana Fabri Thomé, 442, Bairro Claudina, em Vinhedo, Estado de São Paulo, Brasil. A partir da entrega dos produtos para os funcionários e/ou representantes do cliente, este será responsável pelo risco de eventuais danos e/ou perdas referentes aos produtos, ficando a VEIKON ENGENHARIA isenta de qualquer tipo de responsabilidade.</p>
<p>1.5. O cliente é responsável por todo e qualquer débito não saldado relativo aos produtos recebidos da VEIKON ENGENHARIA independentemente de quaisquer perdas e/ou danos decorrentes de atos ou fatos após a entrega, sendo que os pagamentos deverão ser feitos pelo cliente nos 30 (trinta) dias seguintes à data da aceitação do pedido, a menos que outra forma de pagamento tenha sido especificada na proposta comercial da VEIKON ENGENHARIA.</p>
<p>1.6. No caso de o cliente atrasar qualquer dos pagamentos devidos à VEIKON ENGENHARIA, será devida multa sobre o valor em atraso, acrescida de juros e correção monetária sobre o mesmo valor, calculados desde a data de vencimento da fatura até a data do efetivo pagamento, tudo devidamente corrigido, sendo que caso a legislação brasileira venha a permitir a cobrança de taxa maior de juros, esta poderá ser aplicada pela VEIKON ENGENHARIA. Clientes com títulos encaminhados a cartório poderão efetuar compras somente mediante liberação do departamento financeiro e com pagamento à vista. Clientes com títulos atrasados não protestados só poderão efetuar compras faturadas mediante aprovação do departamento Financeiro e Diretoria da VEIKON ENGENHARIA.</p>
<p><strong>2. ACEITE:</strong> O pedido de compra gerado pelo cliente e enviado à VEIKON ENGENHARIA implica aceitação por parte do cliente dos termos e condições previstos no presente documento.</p>
<p><strong>3. CANCELAMENTO:</strong> Em caso de cancelamento de pedido após início dos processos de fabricação, VEIKON ENGENHARIA cobrará uma indenização de 40% (quarenta por cento) do valor do pedido. Após 4 semanas de aceite do pedido, será cobrado a taxa de 100% (cem por cento) da ordem de compra.</p>
<p><strong>4. GARANTIA:</strong> A todos os produtos novos fabricados pela VEIKON ENGENHARIA é dada uma garantia contra defeitos dos materiais ou de fabricação pelo período de 1 (um) ano contado a partir da data de entrega dos produtos, sendo que no caso de ocorrência dos referidos defeitos a VEIKON ENGENHARIA reparará ou substituirá os produtos defeituosos. No caso de produtos reformados ou recuperados, é dada garantia de 3 (três) meses contados a partir da entrega dos produtos. Em casos onde a presença do técnico VEIKON ENGENHARIA seja necessária para devida avaliação do pleito de garantia, os custos de mobilização/desmobilização, serviço, estadia e alimentação serão pagas pelo cliente.</p>
<p>4.1. A garantia dada pela VEIKON ENGENHARIA é condicionada a que os produtos permaneçam com o cliente original. A VEIKON ENGENHARIA não fornece garantia aos produtos que não funcionem devido a desgaste natural, instalação incorreta, vandalismo, uso indevido, acidentes decorrentes do processo de produção do cliente, ou fora das especificações técnicas especificados no Manual de Operação do equipamento ou catalogo do componente.</p>
<p>4.2. O cliente não poderá retornar produtos defeituosos sem a aprovação prévia por escrito da VEIKON ENGENHARIA.</p>
<p>4.3. Os termos do presente instrumento passarão a ser aplicados aos produtos que vierem a ser adquiridos da VEIKON ENGENHARIA a partir da presente data, sendo que qualquer outro acordo anterior com o cliente, que estabeleça disposições diversas das aqui dispostas sobre garantias, não será aplicado aos referidos produtos.</p>
<p>4.4. A VEIKON ENGENHARIA não é responsável por eventuais danos, acidentes e/ou prejuízos, decorrentes de uso, instalação ou operação inadequados dos produtos vendidos pela VEIKON ENGENHARIA, não sendo responsabilizada por qualquer dano direto ou indireto, inclusive danos morais e lucros cessantes que o cliente ou terceiros vierem a sofrer.</p>
<p>4.5. Tendo em vista que os produtos da VEIKON ENGENHARIA são produzidos sob encomenda, com base em projetos e/ou especificações fornecidos pelo cliente, a mesma não é responsável por qualquer falha, danos, defeitos, acidentes e/ou prejuízos ocorridos em função do projeto e/ou especificações fornecidos pelo cliente, bem como por eventuais inadequações do produto às legislações específicas aplicáveis.

“TODOS OS CLIENTES E USUÁRIOS DEVEM CONSULTAR AS REGULAMENTAÇÕES E NORMAS DE SEGURANÇA LOCAIS, ESTADUAIS E FEDERAIS, VIGENTES EM SUAS RESPECTIVAS JURISDIÇÕES PARA FINS DE ADEQUAÇÃO DO PROJETO E/OU ESPECIFICAÇÕES, BEM COMO DO USO E APLICAÇÃO DOS PRODUTOS.”
</p>
<p><strong>5. LIMITAÇÃO DE RESPONSABILIDADE:</strong> A responsabilidade da VEIKON ENGENHARIA pelos seus produtos é limitada a reparos e/ou substituição de peças, ou não sendo possível fazê-los, ao reembolso total do valor do produto. A VEIKON ENGENHARIA não será responsabilizada ou arcará com qualquer outro tipo de dano ou prejuízo, direto ou indireto, material ou moral, que o cliente ou terceiros venham a sofrer em decorrência de seus produtos.</p>
<p><strong>6. RETORNO DE MERCADORIAS:</strong> Todos os produtos da VEIKON ENGENHARIA são produzidos sob encomenda, de forma que o retorno de produtos adquiridos com defeito será condicionado à consulta e aprovação prévia pela VEIKON ENGENHARIA quanto a aplicabilidade da Garantia e seguido de uma autorização por escrito da VEIKON ENGENHARIA para retorno de produtos, cujos fretes deverão ser pré-pagos pelo cliente ou em caso de devoluções por defeitos e/ou ajustes em Garantia, por conta da VEIKON ENGENHARIA.</p>
<p><strong>7. ATRASOS NA ENTREGA DE PRODUTOS:</strong> A VEIKON ENGENHARIA não poderá ser responsabilizada por quaisquer atrasos que tenham resultado de atos, fatos ou circunstâncias que estejam, de forma direta ou indireta, fora de seu controle, inclusive, mas não limitados a, caso fortuito ou força maior, guerra ou emergência nacional, furacão, incêndio, enchente, explosão, não disponibilidade de matéria-prima, falta de energia, controvérsias trabalhistas ou greves, exportação, importação, câmbio de dólar ou qualquer outra regulamentação ou restrição governamental. Fica estabelecido que o cliente não poderá cancelar uma ordem de compra com base em qualquer atraso decorrente de atos, fatos ou circunstâncias, bem como quaisquer outros motivos que não sejam de responsabilidade da VEIKON ENGENHARIA.</p>
<p>7.1. Não será de responsabilidade da VEIKON ENGENHARIA qualquer dano material, moral e/ou lucro cessante, de natureza material ou moral, que o cliente ou terceiros venham a sofrer devido a atrasos na entrega dos produtos ao cliente.</p>
<p><strong>8. ALERTA:</strong> A VEIKON ENGENHARIA não garante que os seus produtos atinjam o desempenho ideal se outras máquinas e equipamentos que o cliente vier a usar de forma conjunta com os produtos da VEIKON ENGENHARIA apresentem falhas, defeitos, ou forem manuseados de forma inadequada.</p>
<p><strong>9. DIVERSOS: </strong> Nenhum empregado, agente, ou representante da VEIKON ENGENHARIA, à exceção de executivo devidamente autorizado, tem autoridade para alterar qualquer termo contido neste documento, ou fazer acordos ou representações não incorporadas no mesmo.</p>
<p>9.1. A atuação de qualquer empregado, agente, ou representante da VEIKON ENGENHARIA nas instalações do cliente, não se configura sob nenhuma forma vínculo empregatício com o cliente em questão.</p>
<p>9.2. Esta ordem de compra, termos e condições gerais são regidos de acordo com a legislação brasileira.</p>
<p><strong>10. FORO:</strong> Eventuais ações e/ou procedimentos judiciais que se fizerem necessários quanto a qualquer tema do presente instrumento serão submetidos ao foro da Comarca de Vinhedo, Estado de São Paulo, com exclusão de qualquer outro.</p>
`;

quillCondicoesGerais.root.innerHTML = condicoesGeraisBoilerplate;

/* ─── TABLE - line items ─── */
const tableBody = document.querySelector("#itens-table tbody");
const addRowBtn = document.getElementById("add-row");
const deleteRowBtn = document.getElementById("delete-row");

const parseBR = (value) => {
  if (!value) return 0;
  return (
    parseFloat(
      value
        .toString()
        .replace(/[^\d,.-]/g, "") // strips currency symbols, letters, spaces
        .replace(/\./g, "")
        .replace(",", "."),
    ) || 0
  );
};

const applyNumFormatting = (value, min = 0, fallback = "0") => {
  value = value
    .replace(/[^0-9.,]/g, "")
    .replace(/\./g, ",")
    .replace(/(,.*),/g, "$1");
  let num = parseFloat(value.replace(",", "."));
  if (isNaN(num) || num < min) return fallback;
  return num;
};

function getMoeda() {
  const moeda = document.getElementById("moeda")?.value || "BRL";
  switch (moeda) {
    case "USD":
      return "USD";
    case "EUR":
      return "EUR";
    default:
      return "BRL";
  }
}

const calcRow = (row) => {
  const qntText = row.querySelector(".quantidade")?.textContent || "0";
  const valText = row.querySelector(".val-unitario")?.textContent || "0";

  const qnt = parseBR(qntText);
  const valUnit = parseBR(valText);

  const total = qnt * valUnit;

  const cellTotal = row.cells[6]; // no IPI column, so total is cells[6] not cells[7]
  if (cellTotal) {
    cellTotal.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: getMoeda(),
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
  if (campoTotal) {
    campoTotal.textContent = total.toLocaleString("pt-BR", {
      style: "currency",
      currency: getMoeda(),
    });
  }
};

if (tableBody) {
  tableBody.addEventListener("focusout", (e) => {
    if (e.target.classList.contains("quantidade")) {
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
      ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const row = e.target.closest("tr");
    if (row) {
      calcRow(row);
      calcTotalGeral();
    }
  });

  // keyboard navigation
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
    calcTotalGeral();
  });
}

/* ─── HELPERS ─── */
function getItensFromTable() {
  return Array.from(tableBody.rows).map((row, index) => ({
    item: index + 1,
    quantidade: parseBR(row.cells[2]?.textContent || "0"),
    descricao: row.cells[3]?.textContent || "",
    unidade: row.cells[4]?.textContent || "",
    val_unitario: parseBR(row.cells[5]?.textContent || "0"),
    total: parseBR(row.cells[6]?.textContent || "0"),
  }));
}

function populateItensTable(itens) {
  tableBody.innerHTML = "";
  itens.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"></td>
      <td>${index + 1}</td>
      <td contenteditable="true" class="quantidade">${item.quantidade}</td>
      <td contenteditable="true">${item.descricao}</td>
      <td contenteditable="true">${item.unidade}</td>
      <td contenteditable="true" class="val-unitario">${item.val_unitario?.toLocaleString(
        "pt-BR",
        {
          style: "currency",
          currency: getMoeda(),
        },
      )}</td>
      <td>${item.total?.toLocaleString("pt-BR", {
        style: "currency",
        currency: getMoeda(),
      })}</td>
    `;
    tableBody.appendChild(tr);
  });
  calcTotalGeral();
}

document.getElementById("moeda")?.addEventListener("change", () => {
  // reformat all val-unitario cells
  Array.from(tableBody.rows).forEach((row) => {
    const valCell = row.querySelector(".val-unitario");
    if (valCell) {
      const raw = parseBR(valCell.textContent);
      if (raw > 0) {
        valCell.textContent = raw.toLocaleString("pt-BR", {
          style: "currency",
          currency: getMoeda(),
        });
      }
    }
  });
  // recalculate all rows and total
  calcTotalGeral();
});

function clearForm() {
  document.getElementById("numCotacao").value = "";
  document.getElementById("dataCotacao").value = "";
  document.getElementById("revisao").value = "0";
  document.getElementById("status").value = "Criada";
  document.getElementById("cliente").value = "";
  document.getElementById("clienteContato").value = "";
  document.getElementById("clienteEmail").value = "";
  document.getElementById("prazoEntrega").value = "";
  document.getElementById("validadeProposta").value = "";
  document.getElementById("condPagamento").value = "";
  document.getElementById("moeda").value = "BRL";
  document.getElementById("objetivo").value = "";
  document.getElementById("alteradoPor").value = "";
  document.getElementById("observacaoStatus").value = "";
  document.getElementById("comprador").value = "";
  document.getElementById("compradorEmail").value = "";
  document.getElementById("compradorTelefone").value = "";
  document.getElementById("statusSelect").value = "Criada";
  quillDescricao.root.innerHTML = "";
  quillCondicoes.root.innerHTML = "";
  quillCondicoesGerais.root.innerHTML = condicoesGeraisBoilerplate;
  tableBody.innerHTML = `
    <tr>
      <td><input type="checkbox" class="row-select"></td>
      <td>1</td>
      <td contenteditable="true" class="quantidade"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td contenteditable="true" class="val-unitario"></td>
      <td></td>
    </tr>
  `;
}

function buildPayload() {
  return {
    num_cotacao:
      document.getElementById("numCotacao")?.value.toUpperCase() || "",
    data_cotacao: document.getElementById("dataCotacao")?.value || "",
    cliente: document.getElementById("cliente")?.value || "",
    cliente_contato: document.getElementById("clienteContato")?.value || "",
    cliente_email: document.getElementById("clienteEmail")?.value || "",
    prazo_entrega: document.getElementById("prazoEntrega")?.value || "",
    data_aceite: document.getElementById("dataAceite")?.value || "",
    data_prevista: document.getElementById("dataPrevistaCotacao")?.value || "",
    validade_proposta: document.getElementById("validadeProposta")?.value || "",
    cond_pagamento: document.getElementById("condPagamento")?.value || "",
    moeda: document.getElementById("moeda")?.value || "BRL",
    objetivo: document.getElementById("objetivo")?.value || "",
    descricao_equipamentos: quillDescricao.root.innerHTML,
    condicoes_proposta: quillCondicoes.root.innerHTML,
    condicoes_gerais: quillCondicoesGerais.root.innerHTML,
    comprador: document.getElementById("comprador")?.value || "",
    comprador_email: document.getElementById("compradorEmail")?.value || "",
    comprador_telefone:
      document.getElementById("compradorTelefone")?.value || "",
    status: document.getElementById("statusSelect")?.value || "Criada",
    alterado_por: document.getElementById("alteradoPor")?.value || "",
    observacao_status: document.getElementById("observacaoStatus")?.value || "",
    itens: getItensFromTable(),
  };
}

/* ─── MODE - new vs edit ─── */
// currentCotacaoId is set when loading an existing cotação for editing
let currentCotacaoId = null;

function atualizarOpcoesStatus(statusAtual) {
  const transicoesPermitidas = {
    Criada: ["Em Análise Técnica", "Cancelada"],
    "Em Análise Técnica": ["Em Análise Financeira", "Criada", "Cancelada"],
    "Em Análise Financeira": [
      "Enviado ao Cliente",
      "Em Análise Técnica",
      "Cancelada",
    ],
    "Enviado ao Cliente": ["Aceita", "Recusada", "Cancelada"],
    Aceita: ["Pausada", "Cancelada"],
    Pausada: ["Aceita", "Cancelada"],
    Recusada: [],
    Cancelada: [],
  };

  const permitidas = transicoesPermitidas[statusAtual] || [];
  const select = document.getElementById("statusSelect");

  // clear and repopulate options
  select.innerHTML = `<option value="${statusAtual}">${statusAtual}</option>`;
  permitidas.forEach((s) => {
    const option = document.createElement("option");
    option.value = s;
    option.textContent = s;
    select.appendChild(option);
  });
}

function setReadOnly(isReadOnly) {
  const inputs = document.querySelectorAll(
    "#form-cotacao input:not([readonly]):not(#alteradoPor):not(#observacaoStatus):not(#dataAceite):not(#prazoEntrega):not(#dataPrevistaCotacao), #form-cotacao select:not(#statusSelect)",
  );
  inputs.forEach((el) => (el.disabled = isReadOnly));
  quillDescricao.enable(!isReadOnly);
  quillCondicoes.enable(!isReadOnly);
  quillCondicoesGerais.enable(!isReadOnly);
  tableBody.querySelectorAll("[contenteditable]").forEach((el) => {
    el.contentEditable = !isReadOnly;
  });
  if (btnSalvar) btnSalvar.style.display = "inline-block";
}

/* ─── SAVE ─── */
const btnSalvar = document.getElementById("btn-salvar");
const btnNovaRevisao = document.getElementById("btn-nova-revisao");

if (btnSalvar) {
  btnSalvar.addEventListener("click", async () => {
    const payload = buildPayload();
    const statusAtual = document.getElementById("status").value;
    const statusNovo = document.getElementById("statusSelect").value;
    const statusMudou = statusNovo !== statusAtual;

    // require alterado_por if status changed
    if (statusMudou && !payload.alterado_por) {
      alert("Por favor, informe quem está alterando o status.");
      return;
    }

    // require observacao if moving to Pausada, Cancelada or Recusada
    if (
      statusMudou &&
      ["Pausada", "Cancelada", "Recusada"].includes(statusNovo) &&
      !payload.observacao_status
    ) {
      alert("Por favor, informe o motivo da alteração de status.");
      return;
    }

    if (!payload.num_cotacao) {
      alert("Por favor, informe o número da cotação.");
      return;
    }
    if (!payload.cliente) {
      alert("Por favor, informe o cliente.");
      return;
    }

    if (currentCotacaoId) {
      const result = await fetch(
        `http://localhost:3000/cotacoes/${currentCotacaoId}`,
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
        // update the readonly status display
        document.getElementById("status").value = statusNovo;
        atualizarOpcoesStatus(statusNovo);
        setReadOnly(false);

        // apply correct read-only state based on new status
        if (["Enviado ao Cliente", "Aceita", "Pausada"].includes(statusNovo)) {
          setReadOnly(true);
        }
        if (statusNovo === "Enviado ao Cliente") {
          if (btnNovaRevisao) btnNovaRevisao.style.display = "inline-block";
        } else {
          if (btnNovaRevisao) btnNovaRevisao.style.display = "none";
        }
        if (["Recusada", "Cancelada"].includes(statusNovo)) {
          if (btnSalvar) btnSalvar.style.display = "none";
        }
        alert("Cotação salva com sucesso!");
      }
    } else {
      const result = await fetch("http://localhost:3000/cotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await result.json();
      if (!result.ok) {
        alert(data.error);
      } else {
        currentCotacaoId = data.id;
        alert("Cotação salva com sucesso!");
      }
    }
  });
}

/* ─── NOVA REVISÃO ─── */
if (btnNovaRevisao) {
  btnNovaRevisao.addEventListener("click", async () => {
    const alteradoPor = document.getElementById("alteradoPor").value;
    if (!alteradoPor) {
      alert("Por favor, informe quem está criando a revisão.");
      return;
    }

    const result = await fetch(
      `http://localhost:3000/cotacoes/${currentCotacaoId}/revisao`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alterado_por: alteradoPor }),
      },
    );

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      // load the new revision into the form
      currentCotacaoId = data.id;
      await carregarCotacao(data.id);
      alert("Nova revisão criada com sucesso!");
    }
  });
}

/* ─── LOAD EXISTING COTAÇÃO ─── */
async function carregarCotacao(id) {
  const res = await fetch(`http://localhost:3000/cotacoes/${id}`);
  const cotacao = await res.json();

  document.getElementById("numCotacao").value = cotacao.num_cotacao;
  document.getElementById("dataCotacao").value = cotacao.data_cotacao;
  document.getElementById("revisao").value = cotacao.revisao;
  document.getElementById("status").value = cotacao.status;
  document.getElementById("cliente").value = cotacao.cliente;
  document.getElementById("clienteContato").value =
    cotacao.cliente_contato || "";
  document.getElementById("clienteEmail").value = cotacao.cliente_email || "";
  document.getElementById("prazoEntrega").value = cotacao.prazo_entrega || "";
  document.getElementById("dataAceite").value = cotacao.data_aceite || "";
  document.getElementById("dataPrevistaCotacao").value =
    cotacao.data_prevista || "";
  document.getElementById("validadeProposta").value =
    cotacao.validade_proposta || "";
  document.getElementById("condPagamento").value = cotacao.cond_pagamento || "";
  document.getElementById("moeda").value = cotacao.moeda || "BRL";
  document.getElementById("objetivo").value = cotacao.objetivo || "";
  document.getElementById("statusSelect").value = cotacao.status;
  atualizarOpcoesStatus(cotacao.status);
  document.getElementById("comprador").value = cotacao.comprador || "";
  document.getElementById("compradorEmail").value =
    cotacao.comprador_email || "";
  document.getElementById("compradorTelefone").value =
    cotacao.comprador_telefone || "";

  quillDescricao.root.innerHTML = cotacao.descricao_equipamentos || "";
  quillCondicoes.root.innerHTML = cotacao.condicoes_proposta || "";
  quillCondicoesGerais.root.innerHTML =
    cotacao.condicoes_gerais || condicoesGeraisBoilerplate;

  populateItensTable(cotacao.itens || []);

  // apply correct state based on status
  const statusAtual = cotacao.status;

  if (["Recusada", "Cancelada"].includes(statusAtual)) {
    setReadOnly(true);
    if (btnSalvar) btnSalvar.style.display = "none";
    if (btnNovaRevisao) btnNovaRevisao.style.display = "none";
  } else if (
    ["Enviado ao Cliente", "Aceita", "Pausada"].includes(statusAtual)
  ) {
    setReadOnly(true);
    if (btnNovaRevisao)
      btnNovaRevisao.style.display =
        statusAtual === "Enviado ao Cliente" ? "inline-block" : "none";
    if (btnSalvar) btnSalvar.style.display = "inline-block";
  } else {
    setReadOnly(false);
    if (btnNovaRevisao) btnNovaRevisao.style.display = "none";
    if (btnSalvar) btnSalvar.style.display = "inline-block";
  }

  atualizarOpcoesStatus(statusAtual);
}

/* ─── ON LOAD ─── */
// Check if a cotação id was passed in the URL, e.g. cotacao.html?id=5
const urlParams = new URLSearchParams(window.location.search);
const cotacaoIdFromUrl = urlParams.get("id");
const isReadOnly = urlParams.get("readonly") === "true";

if (cotacaoIdFromUrl) {
  currentCotacaoId = parseInt(cotacaoIdFromUrl);
  carregarCotacao(currentCotacaoId).then(() => {
    if (isReadOnly) {
      setReadOnly(true);
      const banner = document.createElement("div");
      banner.style.cssText = `
  background: #fd7e14;
  color: white;
  font-weight: bold;
  font-size: 0.85em;
  position: fixed;
  top: 0;
  left: 0;
  width: 28px;
  height: 100vh;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  letter-spacing: 2px;
  cursor: default;
`;
      banner.title =
        "Revisão anterior — somente leitura. Para editar, acesse a revisão atual.";
      banner.textContent = "⚠️ REVISÃO ANTERIOR — SOMENTE LEITURA";
      document.body.insertBefore(banner, document.body.firstChild);
      if (btnSalvar) btnSalvar.style.display = "none";
      if (btnNovaRevisao) btnNovaRevisao.style.display = "none";
    }
  });
} else {
  atualizarOpcoesStatus("Criada");
}

const btnImprimir = document.getElementById("btn-imprimir");

if (btnImprimir) {
  btnImprimir.addEventListener("click", () => {
    if (!currentCotacaoId) {
      alert("Salve a cotação antes de gerar o PDF.");
      return;
    }
    window.open(
      `http://localhost:3000/cotacoes/${currentCotacaoId}/pdf`,
      "_blank",
    );
  });
}

calcularDataPrevistaCotacao();
