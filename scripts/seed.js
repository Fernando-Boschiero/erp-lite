const db = require("./db");

const insert = db.prepare(`
  INSERT OR IGNORE INTO fornecedores (
    razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

/* const fornecedores = [
  [
    "SEW Eurodrive Brasil Ltda",
    "50981018000351",
    "587254403118",
    "Rodovia Washington Luiz SP 310 Km 172",
    "Condominio Industrial Compark",
    "Rio Claro",
    "SP",
    "13501-600",
    "(19) 3522-3100",
  ],
  [
    "Megalaser Industria Metalurgica Ltda",
    "08614279000105",
    "253098629118",
    "Av. Caetano Soraggi, 325",
    "Distrito Industrial",
    "Capivari",
    "SP",
    "13360-000",
    "(19) 3492-4242",
  ],
]; */

for (const f of fornecedores) {
  insert.run(...f);
}

console.log("Seeding done.");
