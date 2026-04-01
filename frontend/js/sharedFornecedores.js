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
