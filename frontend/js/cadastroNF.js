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

    // first read as text with UTF-8 to check encoding declaration
    const sniffReader = new FileReader();
    sniffReader.onload = (e) => {
      const raw = e.target.result;
      const encodingMatch = raw.match(/encoding=["']([^"']+)["']/i);
      const encoding = encodingMatch ? encodingMatch[1].toUpperCase() : "UTF-8";

      // re-read with correct encoding
      const reader = new FileReader();
      reader.onload = (e2) => {
        try {
          const parser = new DOMParser();
          const xml = parser.parseFromString(e2.target.result, "text/xml");

          if (xml.getElementsByTagName("parsererror").length > 0) {
            alert(
              "Erro ao processar o XML. Verifique se o arquivo é uma NF-e válida.",
            );
            return;
          }

          const isNFSe =
            xml.getElementsByTagName("NFSe").length > 0 ||
            xml.getElementsByTagName("nNFSe").length > 0;

          const isCTe =
            xml.getElementsByTagName("cteProc").length > 0 ||
            xml.getElementsByTagName("CTe").length > 0;

          const isNFMunicipal =
            xml.getElementsByTagName("notaFiscal").length > 0 ||
            xml.getElementsByTagName("NotaFiscal").length > 0;

          if (isCTe) {
            processarCTe(xml);
          } else if (isNFSe) {
            processarNFSe(xml);
          } else if (isNFMunicipal) {
            processarNFMunicipal(xml);
          } else {
            processarNFe(xml);
          }
        } catch (err) {
          alert("Erro ao processar o XML: " + err.message);
          console.error(err);
        }
      };
      reader.readAsText(file, encoding);
    };
    sniffReader.readAsText(file, "UTF-8");
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

  const tpNF = getVal(ide, "tpNF");
  const emitCNPJ = getVal(xml.getElementsByTagName("emit")[0], "CNPJ");
  const veikonCNPJ = "19309792000109";

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

  // auto-detect direction
  const direcaoSelect = document.getElementById("direcaoNF");
  if (direcaoSelect) {
    if (emitCNPJ === veikonCNPJ && tpNF === "1") {
      direcaoSelect.value = "Saída";
    } else {
      direcaoSelect.value = "Entrada";
    }
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

/* ─── CT-e PARSER (Conhecimento de Transporte Eletrônico) ─── */
function processarCTe(xml) {
  const ide = xml.getElementsByTagName("ide")[0];
  const emit = xml.getElementsByTagName("emit")[0];
  const vPrest = xml.getElementsByTagName("vPrest")[0];
  const infCarga = xml.getElementsByTagName("infCarga")[0];
  const icmsNode = xml.getElementsByTagName("ICMS")[0];
  const icmsChild = icmsNode?.children?.[0];

  const nNF = getVal(ide, "nCT");
  const dhEmi = getVal(ide, "dhEmi");
  const xNome = getVal(emit, "xNome");
  const vTPrest = parseFloat(getVal(vPrest, "vTPrest")) || 0;
  const proPred = getVal(infCarga, "proPred") || "Serviço de Transporte";

  // ICMS
  const icms_vBC = parseFloat(getVal(icmsChild, "vBC")) || 0;
  const icms_pICMS = parseFloat(getVal(icmsChild, "pICMS")) || 0;
  const icms_vICMS = parseFloat(getVal(icmsChild, "vICMS")) || 0;

  // build synthetic item from freight service
  const itens = [
    {
      nItemPed: "",
      cProd: "",
      xProd: proPred,
      NCM: "",
      uCom: "SV",
      qCom: 1,
      vUnCom: vTPrest,
      vProd: vTPrest,
      uTrib: "SV",
      qTrib: 1,
      vUnTrib: vTPrest,
      icms_vBC,
      icms_pICMS,
      icms_vICMS,
      ipi_vBC: 0,
      ipi_pIPI: 0,
      ipi_vIPI: 0,
      pis_vBC: 0,
      pis_pPIS: 0,
      pis_vPIS: 0,
      cofins_vBC: 0,
      cofins_pCOFINS: 0,
      cofins_vCOFINS: 0,
      total_impostos: icms_vICMS,
    },
  ];

  // CT-e typically has single payment — create one duplicata
  const duplicatas = [
    {
      nDup: "001",
      dVenc: dhEmi ? dhEmi.substring(0, 10) : "",
      vDup: vTPrest,
    },
  ];

  dadosXML = { nNF, dhEmi, xNome, itens, duplicatas };
  preencherFormulario(dadosXML);
}

/* ─── NF MUNICIPAL PARSER (Prefeitura de Vinhedo - Balker) ─── */
function processarNFMunicipal(xml) {
  // handle both capitalization variants
  const cabecario =
    xml.getElementsByTagName("NfeCabecario")[0] ||
    xml.getElementsByTagName("nfeCabecario")[0];
  const dadosPrestador =
    xml.getElementsByTagName("DadosPrestador")[0] ||
    xml.getElementsByTagName("dadosPrestador")[0];
  const dadosTomador =
    xml.getElementsByTagName("DadosTomador")[0] ||
    xml.getElementsByTagName("dadosTomador")[0];

  // handle both DetalhesServico (capital) and detalheServico variants
  const detalheServico =
    xml.getElementsByTagName("DetalhesServico")[0] ||
    xml.getElementsByTagName("detalheServico")[0];

  // handle item wrapper (Usinobre) vs direct fields (M.Dias Branco)
  const item =
    xml.getElementsByTagName("item")[0] || xml.getElementsByTagName("Item")[0];

  // source of description and value
  const descricaoNode = item || detalheServico;
  const descricao =
    getVal(descricaoNode, "descricao") ||
    getVal(descricaoNode, "Descricao") ||
    "";

  // value field varies between formats
  const valor =
    parseFloat(
      getVal(descricaoNode, "valorServico") ||
        getVal(descricaoNode, "valor") ||
        getVal(descricaoNode, "Valor") ||
        "0",
    ) || 0;

  const nNF =
    getVal(cabecario, "numeroNota") || getVal(dadosPrestador, "numeroNota");
  const dhEmiRaw =
    getVal(cabecario, "dataEmissao") || getVal(dadosPrestador, "dataEmissao");
  const [dia, mes, ano] = dhEmiRaw.split("/");
  const dhEmi = `${ano}-${mes}-${dia}T00:00:00`;

  const veikonCNPJ = "19309792000109";
  const prestadorDoc = getVal(dadosPrestador, "documento");
  const prestadorNome = getVal(dadosPrestador, "razaoSocial");
  const tomadorNome = getVal(dadosTomador, "razaoSocial");

  const isSaida = prestadorDoc === veikonCNPJ;
  const xNome = isSaida ? tomadorNome : prestadorNome;

  const direcaoSelect = document.getElementById("direcaoNF");
  if (direcaoSelect) {
    direcaoSelect.value = isSaida ? "Saída" : "Entrada";
  }

  const itens = [
    {
      nItemPed: "",
      cProd:
        getVal(descricaoNode, "codigo") ||
        getVal(descricaoNode, "Codigo") ||
        "",
      xProd: descricao,
      NCM: "",
      uCom: "SV",
      qCom: 1,
      vUnCom: valor,
      vProd: valor,
      uTrib: "SV",
      qTrib: 1,
      vUnTrib: valor,
      icms_vBC: 0,
      icms_pICMS: 0,
      icms_vICMS: 0,
      ipi_vBC: 0,
      ipi_pIPI: 0,
      ipi_vIPI: 0,
      pis_vBC: parseFloat(getVal(detalheServico, "pispasep")) || 0,
      pis_pPIS: 0,
      pis_vPIS: parseFloat(getVal(detalheServico, "pispasep")) || 0,
      cofins_vBC: parseFloat(getVal(detalheServico, "cofins")) || 0,
      cofins_pCOFINS: 0,
      cofins_vCOFINS: parseFloat(getVal(detalheServico, "cofins")) || 0,
      total_impostos: 0,
    },
  ];

  // parse due dates from obs field (M.Dias Branco format)
  const obs = getVal(detalheServico, "obs") || "";
  const duplicatas = [];
  const venctoRegex = /Vencto:\s*(\d{2}\/\d{2}\/\d{4})\s*R\$:\s*([\d.,]+)/g;
  let match;
  let dupNum = 1;
  while ((match = venctoRegex.exec(descricao + " " + obs)) !== null) {
    const [d, m, y] = match[1].split("/");
    const vDup = parseFloat(match[2].replace(/\./g, "").replace(",", ".")) || 0;
    duplicatas.push({
      nDup: String(dupNum).padStart(3, "0"),
      dVenc: `${y}-${m}-${d}`,
      vDup,
    });
    dupNum++;
  }

  if (duplicatas.length === 0) {
    duplicatas.push({
      nDup: "001",
      dVenc: `${ano}-${mes}-${dia}`,
      vDup: valor,
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
      direcao: document.getElementById("direcaoNF")?.value || "Entrada",
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
