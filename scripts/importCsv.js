const fs = require("fs");
const { parse } = require("csv-parse/sync");
const db = require("../backend/db/db");

const insert = db.prepare(`
  INSERT OR IGNORE INTO fornecedores (
    razao_social, cnpj, ie, rua, bairro, cidade, estado, cep, telefone
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const file = fs.readFileSync("../data/fornecedores.csv", "utf-8");

const records = parse(file, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  delimiter: ";",
  bom: true,
});

for (const r of records) {
  if (!r.razao_social || !r.cnpj) continue;

  insert.run(
    r.razao_social,
    String(r.cnpj).replace(/\D/g, ""),
    r.ie ? String(r.ie).replace(/\D/g, "") : null,
    r.rua || "",
    r.bairro || "",
    r.cidade || "",
    r.estado || "",
    r.cep || "",
    r.telefone || "",
  );
}

console.log(Object.keys(records[0]));
console.log(db.prepare("SELECT COUNT(*) as total FROM fornecedores").get());
console.log("Total records:", records.length);
console.log("Import finished");
