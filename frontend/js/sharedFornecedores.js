// shared.js

let fornecedores = [];

function formatCNPJ(cnpj) {
  cnpj = cnpj.replace(/\D/g, "");
  return (
    cnpj.slice(0, 2) +
    "." +
    cnpj.slice(2, 5) +
    "." +
    cnpj.slice(5, 8) +
    "/" +
    cnpj.slice(8, 12) +
    "-" +
    cnpj.slice(12, 14)
  );
}

async function carregarFornecedores() {
  const res = await fetch("http://localhost:3000/fornecedores");
  fornecedores = await res.json();
  return fornecedores;
}

let usuarios = [];

async function carregarUsuarios() {
  const res = await fetch("http://localhost:3000/usuarios");
  usuarios = await res.json();
  return usuarios;
}

function getDataPrevistaStyle(dataPrevista, status, statusesEncerrados = []) {
  if (statusesEncerrados.includes(status)) {
    return { cor: "#6c757d", texto: dataPrevista || "-" };
  }
  if (!dataPrevista) return { cor: "#6c757d", texto: "-" };

  const [dia, mes, ano] = dataPrevista.split("/");
  const dataEntrega = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diffDias = Math.ceil((dataEntrega - hoje) / (1000 * 60 * 60 * 24));

  if (diffDias < 0)
    return { cor: "#dc3545", texto: `${dataPrevista} ⚠️ Atrasado` };
  if (diffDias <= 7)
    return { cor: "#fd7e14", texto: `${dataPrevista} (${diffDias}d)` };
  return { cor: "#198754", texto: `${dataPrevista} (${diffDias}d)` };
}
