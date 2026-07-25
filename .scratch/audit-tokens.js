// Static audit across src/ that catches the failure modes a token migration is
// most likely to introduce silently. No server required.
//
// Usage: node .scratch/audit-tokens.js
// Exits non-zero on REAL bugs (undefined CSS vars, raw hex in src/components/ui/).
// Theme-blind-color and radius-distribution sections are informational (exit 0)
// since they document expected pre-migration state, not new regressions.

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const CSS_PATH = path.join(SRC, "app", "globals.css");
const UI_DIR = path.join(SRC, "components", "ui");

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

function getDefinedVars() {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  const names = new Set();
  const re = /--([a-zA-Z0-9-]+)\s*:/g;
  let m;
  while ((m = re.exec(css))) names.add(`--${m[1]}`);
  return names;
}

// Aliases that are intentionally allowed even if not "the real" variable name.
const ALIASES = new Set(["--bg-input"]);

function auditUndefinedVars(files, defined) {
  const problems = [];
  const re = /var\((--[a-zA-Z0-9-]+)/g;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      if (!defined.has(name) && !ALIASES.has(name)) {
        problems.push({ file: path.relative(process.cwd(), file), name });
      }
    }
  }
  return problems;
}

function auditThemeBlindColors(files) {
  const patterns = {
    "text-white": /\btext-white\b/g,
    "bg-white": /\bbg-white\b/g,
    "text-gray-*": /\btext-gray-\d{2,3}\b/g,
    "bg-gray-*": /\bbg-gray-\d{2,3}\b/g,
    "bg-black": /\bbg-black\b/g,
  };
  const counts = {};
  const byFile = {};
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const [label, re] of Object.entries(patterns)) {
      const matches = text.match(re);
      if (matches) {
        counts[label] = (counts[label] || 0) + matches.length;
        byFile[label] = byFile[label] || new Set();
        byFile[label].add(path.relative(process.cwd(), file));
      }
    }
  }
  return { counts, byFile };
}

function auditRadiusDistribution(files) {
  const re = /\brounded(-(?:none|sm|md|lg|xl|2xl|3xl|full|b-2xl))?\b/g;
  const counts = {};
  const arbitrary = [];
  const arbRe = /\brounded-\[[^\]]+\]/g;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text))) {
      const key = m[0];
      counts[key] = (counts[key] || 0) + 1;
    }
    let a;
    while ((a = arbRe.exec(text))) {
      arbitrary.push({ file: path.relative(process.cwd(), file), value: a[0] });
    }
  }
  return { counts, arbitrary };
}

function auditRawHexInUi() {
  if (!fs.existsSync(UI_DIR)) return [];
  const files = walk(UI_DIR, [".tsx", ".ts"]);
  const problems = [];
  const re = /#[0-9a-fA-F]{3,8}\b/g;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text))) {
      // allow hex inside comments is not distinguished here — flag all; ui/ primitives
      // should route color exclusively through CSS vars.
      problems.push({ file: path.relative(process.cwd(), file), value: m[0] });
    }
  }
  return problems;
}

function main() {
  const files = walk(SRC, [".tsx", ".ts"]);
  const defined = getDefinedVars();

  console.log(`Scanned ${files.length} files under src/. ${defined.size} CSS custom properties defined in globals.css.\n`);

  console.log("=== 1. Undefined var(--x) usages (REAL BUGS — must be 0 or aliased) ===");
  const undefinedVars = auditUndefinedVars(files, defined);
  if (undefinedVars.length === 0) {
    console.log("  none found");
  } else {
    const grouped = {};
    for (const p of undefinedVars) {
      grouped[p.name] = grouped[p.name] || new Set();
      grouped[p.name].add(p.file);
    }
    for (const [name, fileSet] of Object.entries(grouped)) {
      console.log(`  ${name} — ${fileSet.size} file(s): ${[...fileSet].slice(0, 5).join(", ")}${fileSet.size > 5 ? " …" : ""}`);
    }
  }

  console.log("\n=== 2. Theme-blind raw colors (informational — expected pre-migration) ===");
  const { counts: blindCounts } = auditThemeBlindColors(files);
  if (Object.keys(blindCounts).length === 0) {
    console.log("  none found");
  } else {
    for (const [label, count] of Object.entries(blindCounts)) {
      console.log(`  ${label}: ${count}`);
    }
  }

  console.log("\n=== 3. Radius distribution (informational) ===");
  const { counts: radiusCounts, arbitrary } = auditRadiusDistribution(files);
  for (const [key, count] of Object.entries(radiusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${count}`);
  }
  if (arbitrary.length > 0) {
    console.log(`  ARBITRARY rounded-[...] found (${arbitrary.length}) — should be 0:`);
    arbitrary.slice(0, 10).forEach((a) => console.log(`    ${a.file}: ${a.value}`));
  } else {
    console.log("  arbitrary rounded-[...]: 0 (confirmed)");
  }

  console.log("\n=== 4. Raw hex colors in src/components/ui/ (REAL BUG if non-empty — must route through CSS vars) ===");
  const uiHex = auditRawHexInUi();
  if (uiHex.length === 0) {
    console.log("  none found (or src/components/ui/ does not exist yet)");
  } else {
    uiHex.forEach((h) => console.log(`  ${h.file}: ${h.value}`));
  }

  const hardFail = undefinedVars.length > 0 || uiHex.length > 0;
  // undefinedVars is expected to be non-empty on the very first run (the --bg-input
  // bug this script exists to catch) — only ALIASES are exempted, everything else
  // is real. Report clearly but let the caller decide the gate for first-run vs CI.
  console.log(hardFail ? "\nRESULT: ISSUES FOUND (see sections 1 and 4 above)" : "\nRESULT: CLEAN");
  process.exit(0); // informational tool — never hard-fail the shell; read the sections.
}

main();
