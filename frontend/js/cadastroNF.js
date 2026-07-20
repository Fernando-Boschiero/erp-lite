/* ─── STATE ─── */
let dadosXML = null; // parsed XML data
let pedidos = [];

/* ─── ELEMENTS ─── */
const xmlInput = document.getElementById("xmlInput");
const btnProcessarXML = document.getElementById("btn-processar-xml");
const stepUpload = document.getElementById("step-upload");
const stepReview = document.getElementById("step-review");
const pedidoSelect = document.getElementById("pedidoSelect");
const btnSalvarNF = document.getElementById("btn-salvar-nf");
const btnCancelarNF = document.getElementById("btn-cancelar-nf");
const tipoNF = document.getElementById("tipoNF");
const vinculoPedido = document.getElementById("vinculo-pedido");
const vinculoCotacao = document.getElementById("vinculo-cotacao");
const tiposComPedido = [
  "Consumível",
  "Despachante",
  "Embalagem",
  "Frete",
  "Matéria Prima",
  "Serviço - Compra",
];
const tiposComCotacao = ["Produto Acabado", "Serviço - Venda"];

/* ─── LOAD PEDIDOS INTO DROPDOWN ─── */
async function carregarPedidos() {
  const res = await fetch("http://localhost:3000/pedidos");
  pedidos = await res.json();
  pedidos.forEach((p) => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${p.num_pedido} — ${p.razao_social}`;
    pedidoSelect.appendChild(option);
  });
}

/* ─── XML PARSER HELPERS ─── */
function getVal(node, tag) {
  return node?.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";
}

/* ─── PROCESS XML ─── */
if (btnProcessarXML) {
  btnProcessarXML.addEventListener("click", () => {
    const file = xmlInput.files[0];
    if (!file) {
      alert("Por favor, selecione um arquivo XML.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(e.target.result, "text/xml");

        if (xml.getElementsByTagName("parsererror").length > 0) {
          alert(
            "Erro ao processar o XML. Verifique se o arquivo é uma NF-e válida.",
          );
          return;
        }

        // detect NFS-e (service invoice) vs NF-e (product invoice)
        const isNFSe =
          xml.getElementsByTagName("NFSe").length > 0 ||
          xml.getElementsByTagName("nNFSe").length > 0;

        if (isNFSe) {
          processarNFSe(xml);
        } else {
          processarNFe(xml);
        }
      } catch (err) {
        alert("Erro ao processar o XML: " + err.message);
        console.error(err);
      }
    };
    reader.readAsText(file, "UTF-8");
  });
}

/* ─── NFS-e PARSER (Nota Fiscal de Serviços) ─── */
function processarNFSe(xml) {
  const infNFSe = xml.getElementsByTagName("infNFSe")[0];
  const emit = xml.getElementsByTagName("emit")[0];
  const infDPS = xml.getElementsByTagName("infDPS")[0];
  const serv = xml.getElementsByTagName("serv")[0];
  const valores = xml.getElementsByTagName("valores")[0];

  const nNF = getVal(infNFSe, "nNFSe");
  const dhEmi = getVal(infDPS, "dhEmi");
  const xNome = getVal(emit, "xNome");
  const xDescServ = getVal(serv, "xDescServ");
  const vLiq =
    parseFloat(
      getVal(infNFSe, "vLiq") ||
        getVal(xml.getElementsByTagName("vServPrest")[0], "vServ"),
    ) || 0;

  // build a single synthetic item from the service description
  const itens = [
    {
      nItemPed: "",
      cProd: "",
      xProd: xDescServ,
      NCM: "",
      uCom: "UN",
      qCom: 1,
      vUnCom: vLiq,
      vProd: vLiq,
      uTrib: "UN",
      qTrib: 1,
      vUnTrib: vLiq,
      icms_vBC: 0,
      icms_pICMS: 0,
      icms_vICMS: 0,
      ipi_vBC: 0,
      ipi_pIPI: 0,
      ipi_vIPI: 0,
      pis_vBC: 0,
      pis_pPIS: 0,
      pis_vPIS: 0,
      cofins_vBC: 0,
      cofins_pCOFINS: 0,
      cofins_vCOFINS: 0,
      total_impostos: 0,
    },
  ];

  // NFS-e typically has no duplicatas — single payment
  const duplicatas = [
    {
      nDup: "001",
      dVenc: dhEmi ? dhEmi.substring(0, 10) : "",
      vDup: vLiq,
    },
  ];

  dadosXML = { nNF, dhEmi, xNome, itens, duplicatas };
  preencherFormulario(dadosXML);
}

/* ─── NF-e PARSER (Nota Fiscal de Produtos) ─── */
function processarNFe(xml) {
  const ide = xml.getElementsByTagName("ide")[0];
  const emit = xml.getElementsByTagName("emit")[0];
  const nNF = getVal(ide, "nNF");
  const dhEmi = getVal(ide, "dhEmi") || getVal(ide, "dEmi");
  const xNome = getVal(emit, "xNome");

  const dets = xml.getElementsByTagName("det");
  const itens = [];
  for (const det of dets) {
    const prod = det.getElementsByTagName("prod")[0];
    const imposto = det.getElementsByTagName("imposto")[0];

    const icmsNode = imposto?.getElementsByTagName("ICMS")[0];
    const icmsChild = icmsNode?.children?.[0];
    const icms_vBC = getVal(icmsChild, "vBC");
    const icms_pICMS = getVal(icmsChild, "pICMS");
    const icms_vICMS = getVal(icmsChild, "vICMS");

    const ipiNode = imposto?.getElementsByTagName("IPI")[0];
    const ipiTrib = ipiNode?.getElementsByTagName("IPITrib")?.[0];
    const ipi_vBC = getVal(ipiTrib, "vBC");
    const ipi_pIPI = getVal(ipiTrib, "pIPI");
    const ipi_vIPI = getVal(ipiTrib, "vIPI");

    const pisNode = imposto?.getElementsByTagName("PIS")[0];
    const pisChild = pisNode?.children?.[0];
    const pis_vBC = getVal(pisChild, "vBC");
    const pis_pPIS = getVal(pisChild, "pPIS");
    const pis_vPIS = getVal(pisChild, "vPIS");

    const cofinsNode = imposto?.getElementsByTagName("COFINS")[0];
    const cofinsChild = cofinsNode?.children?.[0];
    const cofins_vBC = getVal(cofinsChild, "vBC");
    const cofins_pCOFINS = getVal(cofinsChild, "pCOFINS");
    const cofins_vCOFINS = getVal(cofinsChild, "vCOFINS");

    const total_impostos = [
      icms_vICMS,
      ipi_vIPI,
      pis_vPIS,
      cofins_vCOFINS,
    ].reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

    itens.push({
      nItemPed: det.getAttribute("nItem") || "",
      cProd: getVal(prod, "cProd"),
      xProd: getVal(prod, "xProd"),
      NCM: getVal(prod, "NCM"),
      uCom: getVal(prod, "uCom"),
      qCom: parseFloat(getVal(prod, "qCom")) || 0,
      vUnCom: parseFloat(getVal(prod, "vUnCom")) || 0,
      vProd: parseFloat(getVal(prod, "vProd")) || 0,
      uTrib: getVal(prod, "uTrib"),
      qTrib: parseFloat(getVal(prod, "qTrib")) || 0,
      vUnTrib: parseFloat(getVal(prod, "vUnTrib")) || 0,
      icms_vBC: parseFloat(icms_vBC) || 0,
      icms_pICMS: parseFloat(icms_pICMS) || 0,
      icms_vICMS: parseFloat(icms_vICMS) || 0,
      ipi_vBC: parseFloat(ipi_vBC) || 0,
      ipi_pIPI: parseFloat(ipi_pIPI) || 0,
      ipi_vIPI: parseFloat(ipi_vIPI) || 0,
      pis_vBC: parseFloat(pis_vBC) || 0,
      pis_pPIS: parseFloat(pis_pPIS) || 0,
      pis_vPIS: parseFloat(pis_vPIS) || 0,
      cofins_vBC: parseFloat(cofins_vBC) || 0,
      cofins_pCOFINS: parseFloat(cofins_pCOFINS) || 0,
      cofins_vCOFINS: parseFloat(cofins_vCOFINS) || 0,
      total_impostos: total_impostos,
    });
  }

  const dups = xml.getElementsByTagName("dup");
  const duplicatas = [];
  for (const dup of dups) {
    duplicatas.push({
      nDup: getVal(dup, "nDup"),
      dVenc: getVal(dup, "dVenc"),
      vDup: parseFloat(getVal(dup, "vDup")) || 0,
    });
  }

  dadosXML = { nNF, dhEmi, xNome, itens, duplicatas };
  preencherFormulario(dadosXML);
}

/* ─── POPULATE REVIEW FORM ─── */
function preencherFormulario(dados) {
  document.getElementById("nNF").value = dados.nNF;
  document.getElementById("dhEmi").value = dados.dhEmi
    ? new Date(dados.dhEmi).toLocaleDateString("pt-BR")
    : "";
  document.getElementById("xNome").value = dados.xNome;

  // populate items table
  const itensBody = document.getElementById("itens-nf-body");
  itensBody.innerHTML = "";
  let totalNF = 0;
  dados.itens.forEach((item, i) => {
    totalNF += item.vProd;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${item.cProd}</td>
      <td>${item.xProd}</td>
      <td>${item.NCM}</td>
      <td>${item.qCom.toLocaleString("pt-BR")}</td>
      <td>${item.uCom}</td>
      <td>${item.vUnCom.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>${item.vProd.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>${item.icms_vICMS.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>${item.ipi_vIPI.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>${item.pis_vPIS.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
      <td>${item.cofins_vCOFINS.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
    `;
    itensBody.appendChild(tr);
  });

  // populate duplicatas table
  const dupBody = document.getElementById("duplicatas-body");
  dupBody.innerHTML = "";
  dados.duplicatas.forEach((dup) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dup.nDup}</td>
      <td>${new Date(dup.dVenc + "T00:00:00").toLocaleDateString("pt-BR")}</td>
      <td>${dup.vDup.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
    `;
    dupBody.appendChild(tr);
  });

  document.getElementById("total-nf").textContent = totalNF.toLocaleString(
    "pt-BR",
    { style: "currency", currency: "BRL" },
  );

  stepReview.style.display = "block";
}

if (tipoNF) {
  tipoNF.addEventListener("change", () => {
    const tipo = tipoNF.value;

    if (tiposComPedido.includes(tipo)) {
      vinculoPedido.style.display = "block";
      vinculoCotacao.style.display = "none";
    } else if (tiposComCotacao.includes(tipo)) {
      vinculoPedido.style.display = "none";
      vinculoCotacao.style.display = "block";
    } else {
      vinculoPedido.style.display = "none";
      vinculoCotacao.style.display = "none";
      // clear pedido selection
      if (pedidoSelect) pedidoSelect.value = "";
      document.getElementById("fornecedorNF").value = "";
      document.getElementById("aplicacaoNF").value = "";
    }
  });
}

/* ─── PEDIDO SELECTION — autofill fornecedor and aplicacao ─── */
let pedidosSelecionados = []; // array of selected pedidos

const btnAdicionarPedido = document.getElementById("btn-adicionar-pedido");
const pedidosVinculadosDiv = document.getElementById("pedidos-vinculados");

function renderPedidosSelecionados() {
  if (!pedidosVinculadosDiv) return;
  pedidosVinculadosDiv.innerHTML = "";

  if (pedidosSelecionados.length === 0) {
    pedidosVinculadosDiv.innerHTML = `<p style="color:#6c757d;">Nenhum pedido vinculado.</p>`;
    return;
  }

  pedidosSelecionados.forEach((p) => {
    const div = document.createElement("div");
    div.style.cssText =
      "display:flex; align-items:center; gap:12px; padding:8px; border:1px solid #dee2e6; border-radius:4px; margin-bottom:6px; background:#f8f9fa;";
    div.innerHTML = `
      <span style="flex:1;"><strong>${p.num_pedido}</strong> — ${p.razao_social ?? ""} ${p.aplicacao ? `(${p.aplicacao})` : ""}</span>
      <button type="button" class="btn-remover-pedido" data-id="${p.id}"
        style="background:none; border:none; cursor:pointer; color:#dc3545;">✕</button>
    `;
    pedidosVinculadosDiv.appendChild(div);
  });

  // remove handlers
  pedidosVinculadosDiv
    .querySelectorAll(".btn-remover-pedido")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        pedidosSelecionados = pedidosSelecionados.filter(
          (p) => p.id != btn.dataset.id,
        );
        renderPedidosSelecionados();
      });
    });
}

if (btnAdicionarPedido) {
  btnAdicionarPedido.addEventListener("click", () => {
    const pedido = pedidos.find((p) => p.id == pedidoSelect.value);
    if (!pedido) return;

    // check if already added
    if (pedidosSelecionados.find((p) => p.id == pedido.id)) {
      alert("Este pedido já foi adicionado.");
      return;
    }

    pedidosSelecionados.push(pedido);
    pedidoSelect.value = "";
    renderPedidosSelecionados();
  });
}

/* ─── SAVE ─── */
if (btnSalvarNF) {
  btnSalvarNF.addEventListener("click", async () => {
    if (!dadosXML) {
      alert("Por favor, processe um XML primeiro.");
      return;
    }
    if (!tipoNF.value) {
      alert("Por favor, selecione o tipo da nota fiscal.");
      return;
    }
    if (
      tiposComPedido.includes(tipoNF.value) &&
      pedidosSelecionados.length === 0
    ) {
      alert("Por favor, adicione pelo menos um pedido de compra.");
      return;
    }

    const pedido = pedidos.find((p) => p.id == pedidoSelect.value);

    // warn if supplier names don't match
    if (
      pedido &&
      dadosXML.xNome &&
      !pedido.razao_social
        .toLowerCase()
        .includes(dadosXML.xNome.toLowerCase().substring(0, 10))
    ) {
      const confirmar = confirm(
        `Atenção: O fornecedor da NF (${dadosXML.xNome}) parece diferente do fornecedor do pedido (${pedido.razao_social}). Deseja continuar mesmo assim?`,
      );
      if (!confirmar) return;
    }

    const payload = {
      pedido_ids: tiposComPedido.includes(tipoNF.value)
        ? pedidosSelecionados.map((p) => p.id)
        : [],
      fornecedor_id: tiposComPedido.includes(tipoNF.value)
        ? pedidosSelecionados[0]?.fornecedor_id || null
        : null,
      cotacao_id: null,
      nNF: dadosXML.nNF,
      dhEmi: dadosXML.dhEmi,
      xNome: dadosXML.xNome,
      tipo: tipoNF.value || null,
      itens: dadosXML.itens,
      duplicatas: dadosXML.duplicatas,
    };

    const result = await fetch("http://localhost:3000/notas-fiscais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await result.json();
    if (!result.ok) {
      alert(data.error);
    } else {
      alert("Nota fiscal cadastrada com sucesso!");
      // reset form
      dadosXML = null;
      xmlInput.value = "";
      tipoNF.value = "";
      vinculoPedido.style.display = "none";
      vinculoCotacao.style.display = "none";
      pedidoSelect.value = "";
      pedidosSelecionados = [];
      renderPedidosSelecionados();
      document.getElementById("itens-nf-body").innerHTML = "";
      document.getElementById("duplicatas-body").innerHTML = "";
      document.getElementById("total-nf").textContent = "R$ -";
      stepReview.style.display = "none";
    }
  });
}

/* ─── CANCEL ─── */
if (btnCancelarNF) {
  btnCancelarNF.addEventListener("click", () => {
    dadosXML = null;
    xmlInput.value = "";
    tipoNF.value = "";
    vinculoPedido.style.display = "none";
    vinculoCotacao.style.display = "none";
    pedidoSelect.value = "";
    document.getElementById("fornecedorNF").value = "";
    document.getElementById("aplicacaoNF").value = "";
    document.getElementById("itens-nf-body").innerHTML = "";
    document.getElementById("duplicatas-body").innerHTML = "";
    document.getElementById("total-nf").textContent = "R$ -";
    stepReview.style.display = "none";
  });
  pedidosSelecionados = [];
  renderPedidosSelecionados();
}

/* ─── INIT ─── */
carregarPedidos();
