import fs from "fs";

const canon = fs.readFileSync(".scratch/audit/schema_canonical.sql", "utf8");
const migr = fs.readFileSync(".scratch/audit/migrations_concat.sql", "utf8");

// ---- parse CREATE TABLE blocks: name -> Set(columns) ----
function parseCreateTables(sql) {
  const tables = {};
  const re = /CREATE TABLE\s+"([A-Za-z_]+)"\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1];
    const body = m[2];
    const cols = new Set();
    for (const line of body.split("\n")) {
      const t = line.trim();
      const cm = t.match(/^"([A-Za-z_]+)"\s+/);
      if (cm && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE)\b/.test(t)) cols.add(cm[1]);
    }
    tables[name] = cols;
  }
  return tables;
}

// ---- apply ALTER TABLE column ops (migrations only) ----
function applyAlters(sql, tables) {
  // ADD COLUMN (possibly multiple, possibly IF NOT EXISTS)
  const addRe = /ALTER TABLE\s+"([A-Za-z_]+)"\s+([\s\S]*?);/g;
  let m;
  while ((m = addRe.exec(sql))) {
    const name = m[1];
    const stmt = m[2];
    if (!tables[name]) tables[name] = new Set();
    for (const part of stmt.split(/,(?=\s*(?:ADD|DROP|ALTER|RENAME))/)) {
      let a;
      if ((a = part.match(/ADD COLUMN\s+(?:IF NOT EXISTS\s+)?"([A-Za-z_]+)"/))) tables[name].add(a[1]);
      else if ((a = part.match(/DROP COLUMN\s+(?:IF EXISTS\s+)?"([A-Za-z_]+)"/))) tables[name].delete(a[1]);
      else if ((a = part.match(/RENAME COLUMN\s+"([A-Za-z_]+)"\s+TO\s+"([A-Za-z_]+)"/))) { tables[name].delete(a[1]); tables[name].add(a[2]); }
    }
    const rn = stmt.match(/^RENAME TO\s+"([A-Za-z_]+)"/);
    if (rn) { tables[rn[1]] = tables[name]; delete tables[name]; }
  }
  return tables;
}

// ---- enums ----
function parseEnums(sql) {
  const e = {};
  let m;
  const re = /CREATE TYPE\s+"([A-Za-z_]+)"\s+AS ENUM\s*\(([^)]*)\)/g;
  while ((m = re.exec(sql))) {
    e[m[1]] = new Set([...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  }
  // ALTER TYPE ... ADD VALUE
  const av = /ALTER TYPE\s+"([A-Za-z_]+)"\s+ADD VALUE\s+(?:IF NOT EXISTS\s+)?'([^']*)'/g;
  while ((m = av.exec(sql))) { (e[m[1]] ??= new Set()).add(m[2]); }
  return e;
}

const cTables = parseCreateTables(canon);
let mTables = parseCreateTables(migr);
mTables = applyAlters(migr, mTables);

const cEnums = parseEnums(canon);
const mEnums = parseEnums(migr);

const diff = (a, b) => [...a].filter((x) => !b.has(x));

console.log("=== TABLE COLUMN DIFF (schema.prisma canonical  vs  migrations-applied) ===\n");
let clean = true;
for (const t of Object.keys(cTables).sort()) {
  const cc = cTables[t];
  const mc = mTables[t] || new Set();
  const missingInMigr = diff(cc, mc);   // schema has it, migrations don't produce it  => DRIFT (db push only)
  const extraInMigr = diff(mc, cc);     // migrations produce it, schema doesn't have it => stale/removed in schema
  if (missingInMigr.length || extraInMigr.length) {
    clean = false;
    console.log(`  ${t}:`);
    if (missingInMigr.length) console.log(`     IN schema.prisma, NOT in migrations : ${missingInMigr.join(", ")}`);
    if (extraInMigr.length)   console.log(`     IN migrations, NOT in schema.prisma : ${extraInMigr.join(", ")}`);
  }
}
if (clean) console.log("  (no column differences — every schema.prisma column is produced by a migration)");

console.log("\n=== ENUM VALUE DIFF ===\n");
let ecleanflag = true;
for (const e of Object.keys(cEnums).sort()) {
  const missingInMigr = diff(cEnums[e], mEnums[e] || new Set());
  const extraInMigr = diff(mEnums[e] || new Set(), cEnums[e]);
  if (missingInMigr.length || extraInMigr.length) {
    ecleanflag = false;
    console.log(`  ${e}: schema-only=[${missingInMigr.join(",")}]  migr-only=[${extraInMigr.join(",")}]`);
  }
}
if (ecleanflag) console.log("  (all enum values match)");

console.log("\n=== table presence ===");
console.log("  schema tables:", Object.keys(cTables).length, " migration tables:", Object.keys(mTables).length);
console.log("  schema-only:", diff(new Set(Object.keys(cTables)), new Set(Object.keys(mTables))).join(", ") || "none");
console.log("  migration-only:", diff(new Set(Object.keys(mTables)), new Set(Object.keys(cTables))).join(", ") || "none");
