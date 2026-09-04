/**
 * AUDIT ONLY — Area H walk. Drives the running app (http://localhost:3000,
 * scratch DB) as admin / dealer / staff across four viewports, capturing:
 *   - document HTTP status
 *   - console errors + uncaught page errors
 *   - failed sub-requests (>=400)
 *   - nav timing (domContentLoaded, load)
 *   - a screenshot per route per viewport
 *
 * Plus a focused F-13 probe (non-numeric / negative / huge ?page= values).
 *
 * Prereqs: app up, DB tunnel up, and the three accounts' passwords reset via
 * reset-scratch-passwords.mjs. Optional STAFF account via AUDIT_STAFF_EMAIL.
 *
 * Output: .scratch/audit/area-h/<role>/... .png  and  results.json
 *
 * Usage:
 *   node scripts/audit/area-h-walk.mjs
 *   node scripts/audit/area-h-walk.mjs --role=admin --no-shots
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const PW = process.env.AUDIT_WALK_PASSWORD || "Audit-H-2026-scratch";
const OUT = resolve(process.cwd(), ".scratch/audit/area-h");
const SHOTS = !process.argv.includes("--no-shots");
const ONLY_ROLE = (process.argv.find((a) => a.startsWith("--role=")) || "").split("=")[1];

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1536", width: 1536, height: 864 },
];

const ACCOUNTS = {
  admin: { email: "admin@motoxplus.in", routes: [
    "/admin/dashboard", "/admin/orders", "/admin/products", "/admin/dealers",
    "/admin/payments", "/admin/refunds", "/admin/invoices", "/admin/crm/leads",
    "/admin/crm/pipeline", "/admin/procurement/grn", "/admin/procurement/purchase-orders",
    "/admin/procurement/requests", "/admin/vendors", "/admin/reviews", "/admin/staff",
    "/admin/settings", "/admin/vehicles", "/admin/admins",
  ]},
  dealer: { email: "dealer@testshop.in", routes: [
    "/dealer/dashboard", "/dealer/products", "/dealer/cart", "/dealer/checkout",
    "/dealer/orders", "/dealer/invoices", "/dealer/profile", "/dealer/documents",
  ]},
  staff: { email: process.env.AUDIT_STAFF_EMAIL || null, routes: [
    // The exact set O-1 / S-03 / S-08 hinge on: nav advertises these to staff
    // departments; the API routes behind them are ADMIN/SUPER_ADMIN only.
    "/admin/dashboard", "/admin/orders", "/admin/products",
    "/admin/procurement/grn", "/admin/procurement/purchase-orders",
    "/admin/crm/leads", "/admin/crm/pipeline",
  ]},
};

async function apiLogin(context, email) {
  const res = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email, password: PW },
    headers: { "content-type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

async function walkRoute(page, url) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const onConsole = (m) => { if (m.type() === "error") consoleErrors.push(m.text()); };
  const onPageError = (e) => pageErrors.push(String(e));
  const onResponse = (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`); };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  let status = null, timing = {};
  try {
    const resp = await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    status = resp ? resp.status() : null;
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    timing = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transferKB: Math.round((n.transferSize || 0) / 1024) } : {};
    }).catch(() => ({}));
  } catch (e) {
    pageErrors.push(`goto failed: ${e.message}`);
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
  const finalUrl = page.url().replace(BASE, "");
  return { url, finalUrl, redirected: finalUrl !== url, status, timing, consoleErrors, pageErrors, failedRequests };
}

async function f13Probe(context) {
  const cases = ["abc", "-1", "0", "1.5", "999999", "1e9", " ", "%20", "null"];
  const out = [];
  for (const p of cases) {
    const u = `${BASE}/admin/orders?page=${encodeURIComponent(p)}`;
    try {
      const r = await context.request.get(u);
      const text = (await r.text()).slice(0, 300).replace(/\s+/g, " ");
      out.push({ page: p, status: r.status(), bodyHead: text });
    } catch (e) {
      out.push({ page: p, error: e.message });
    }
  }
  return out;
}

async function main() {
  const browser = await chromium.launch();
  const results = { base: BASE, when: new Date().toISOString(), roles: {}, f13: null };

  for (const [role, cfg] of Object.entries(ACCOUNTS)) {
    if (ONLY_ROLE && role !== ONLY_ROLE) continue;
    if (!cfg.email) { results.roles[role] = { skipped: "no account (set AUDIT_STAFF_EMAIL)" }; continue; }

    const context = await browser.newContext();
    const login = await apiLogin(context, cfg.email);
    results.roles[role] = { email: cfg.email, login, routes: [] };
    if (!login.ok) { await context.close(); continue; }
    results.roles[role].loginRole = login.body?.user?.role;

    for (const vp of VIEWPORTS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of cfg.routes) {
        const r = await walkRoute(page, route);
        r.viewport = vp.name;
        if (SHOTS) {
          const dir = resolve(OUT, role);
          mkdirSync(dir, { recursive: true });
          const slug = route.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
          await page.screenshot({ path: resolve(dir, `${slug}__${vp.name}.png`), fullPage: true }).catch(() => {});
        }
        results.roles[role].routes.push(r);
        const flag = (r.status >= 400 || r.pageErrors.length || r.consoleErrors.length) ? " ⚠" : "";
        console.log(`[${role} ${vp.name}] ${route} -> ${r.status}${r.redirected ? ` (→ ${r.finalUrl})` : ""} dcl=${r.timing.domContentLoaded ?? "?"}ms${flag}`);
      }
      await page.close();
    }

    if (role === "admin") {
      results.f13 = await f13Probe(context);
      console.log("\nF-13 probe:");
      for (const c of results.f13) console.log(`  ?page=${JSON.stringify(c.page)} -> ${c.status ?? c.error}`);
    }
    await context.close();
  }

  await browser.close();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\nWrote ${resolve(OUT, "results.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
