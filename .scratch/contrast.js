// Computes WCAG contrast ratios for CSS custom properties defined in src/app/globals.css.
// Parses `:root`/`.light` and `.dark` blocks, resolves hex values, and checks a curated
// list of (foreground, background) pairs that matter for readability.
//
// Usage: node .scratch/contrast.js
// Exits non-zero if any REQUIRED pair falls below its WCAG target.

const fs = require("fs");
const path = require("path");

const CSS_PATH = path.join(__dirname, "..", "src", "app", "globals.css");

function parseBlock(css, selectorRegex) {
  const match = css.match(selectorRegex);
  if (!match) return {};
  const body = match[1];
  const vars = {};
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(body))) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

function hexToRgb(hex) {
  hex = hex.trim();
  const m3 = /^#([0-9a-f]{3})$/i.exec(hex);
  if (m3) {
    const [r, g, b] = m3[1].split("").map((c) => parseInt(c + c, 16));
    return [r, g, b];
  }
  const m6 = /^#([0-9a-f]{6})$/i.exec(hex);
  if (m6) {
    const n = parseInt(m6[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

function relLuminance([r, g, b]) {
  const srgb = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return null;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

function resolve(vars, name, fallback) {
  let v = vars[name.replace("var(", "").replace(")", "")] ?? vars[name] ?? fallback;
  if (typeof v === "string" && v.startsWith("var(")) {
    return resolve(vars, v.slice(4, -1), fallback);
  }
  return v;
}

// Pairs that matter: [label, fgVar, bgVar, target, kind]
// kind: "text" -> 4.5:1 (WCAG AA normal text), "ui" -> 3:1 (WCAG 1.4.11 UI boundary)
const PAIRS = [
  ["text-primary on surface-1 (card)", "--text-primary", "--bg-secondary", 4.5, "text"],
  ["text-primary on surface-0 (canvas)", "--text-primary", "--bg-primary", 4.5, "text"],
  ["text-secondary on surface-1", "--text-secondary", "--bg-secondary", 4.5, "text"],
  ["text-muted on surface-1", "--text-muted", "--bg-secondary", 4.5, "text"],
  ["text-muted on surface-0", "--text-muted", "--bg-primary", 4.5, "text"],
  ["accent-text on surface-1", "--accent-text", "--bg-secondary", 4.5, "text"],
  ["accent-fg on accent fill", "--accent-fg", "--accent", 4.5, "text"],
  ["input-border on surface-1 (UI boundary)", "--input-border", "--bg-secondary", 3.0, "ui"],
  ["border-color on surface-1 (UI boundary, informational)", "--border-color", "--bg-secondary", 3.0, "informational"],
  ["sig-ok-fg on sig-ok-bg", "--sig-ok-fg", "--sig-ok-bg", 4.5, "text"],
  ["sig-warn-fg on sig-warn-bg", "--sig-warn-fg", "--sig-warn-bg", 4.5, "text"],
  ["sig-danger-fg on sig-danger-bg", "--sig-danger-fg", "--sig-danger-bg", 4.5, "text"],
  ["sig-info-fg on sig-info-bg", "--sig-info-fg", "--sig-info-bg", 4.5, "text"],
  ["sig-progress-fg on sig-progress-bg", "--sig-progress-fg", "--sig-progress-bg", 4.5, "text"],
  ["sig-neutral-fg on sig-neutral-bg", "--sig-neutral-fg", "--sig-neutral-bg", 4.5, "text"],
];

function run() {
  if (!fs.existsSync(CSS_PATH)) {
    console.error("globals.css not found at", CSS_PATH);
    process.exit(1);
  }
  const css = fs.readFileSync(CSS_PATH, "utf8");

  // Matches ":root, .light { ... }" or ":root { ... }" (first, most permissive block found)
  const lightVars = parseBlock(css, /:root(?:\s*,\s*\.light)?\s*\{([\s\S]*?)\n\}/);
  const lightVarsAlt = parseBlock(css, /\.light\s*\{([\s\S]*?)\n\}/);
  const darkVars = parseBlock(css, /\.dark\s*\{([\s\S]*?)\n\}/);

  const light = { ...lightVars, ...lightVarsAlt };

  const themes = [
    ["LIGHT", light],
    ["DARK", { ...light, ...darkVars }],
  ];

  let hadFailure = false;
  let checkedAny = false;

  for (const [themeName, vars] of themes) {
    console.log(`\n=== ${themeName} ===`);
    for (const [label, fgVar, bgVar, target, kind] of PAIRS) {
      const fg = resolve(vars, fgVar);
      const bg = resolve(vars, bgVar);
      if (!fg || !bg) {
        console.log(`  SKIP  ${label} (fg=${fg} bg=${bg} — var not found in this theme yet)`);
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio === null) {
        console.log(`  SKIP  ${label} (non-hex value: fg=${fg} bg=${bg})`);
        continue;
      }
      checkedAny = true;
      const pass = ratio >= target;
      const flag = kind === "informational" ? (pass ? "OK  " : "INFO") : pass ? "PASS" : "FAIL";
      console.log(
        `  ${flag}  ${label}: ${ratio.toFixed(2)}:1 (target ${target}:1) [fg=${fg} bg=${bg}]`
      );
      if (!pass && kind !== "informational") hadFailure = true;
    }
  }

  if (!checkedAny) {
    console.log("\nNo pairs could be resolved — this is expected before P1-a rewrites globals.css.");
    process.exit(0);
  }

  console.log(hadFailure ? "\nRESULT: FAIL — one or more required pairs below WCAG target." : "\nRESULT: PASS");
  process.exit(hadFailure ? 1 : 0);
}

run();
