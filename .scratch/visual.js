// Screenshot sweep across public + portal routes, both themes, two viewports.
// Used as a before/after safety net for the token migration (no test suite exists).
//
// Usage:
//   node .scratch/visual.js baseline    # run BEFORE any token/CSS change
//   node .scratch/visual.js current     # run again after each commit, diff by eye
//     (or against .scratch/shots/baseline/ with a tool like pixelmatch/odiff if desired)

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT_NAME = process.argv[2] || "current";
const SHOTS_DIR = path.join(__dirname, "shots", OUT_NAME);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const THEMES = ["light", "dark"];

const PUBLIC_ROUTES = [
  "/",
  "/products",
  "/vehicles",
  "/vehicles/motorcycle",
  "/about",
  "/contact",
  "/become-dealer",
  "/become-vendor",
  "/privacy",
  "/terms",
  "/login",
  "/register",
];
const DEALER_ROUTES = ["/dealer/dashboard", "/dealer/products", "/dealer/orders", "/dealer/invoices", "/dealer/cart"];
const VENDOR_ROUTES = ["/vendor/dashboard", "/vendor/products", "/vendor/purchase-orders", "/vendor/payments"];
const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/products",
  "/admin/orders",
  "/admin/dealers",
  "/admin/vendors",
  "/admin/crm/leads",
];

// Same test accounts already used by .scratch/e2e_full.js
const CREDS = {
  dealer: { email: "dealer@testshop.in", password: "Dealer@123456" },
  vendor: { email: "vendor@testparts.in", password: "Vendor@123456" },
  admin: { email: "admin@motoxplus.in", password: "Admin@123456" },
};

async function login(browser, role) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 });
  await page.fill('input[placeholder*="you@company.com"]', CREDS[role].email);
  await page.fill('input[placeholder="Your password"]', CREDS[role].password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  const loggedIn = !page.url().includes("/login");
  const state = await context.storageState();
  await context.close();
  return { state, loggedIn };
}

function safeName(route) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/\//g, "_");
}

async function shootRoutes(browser, routes, storageState, label) {
  let ok = 0;
  let failed = 0;
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState,
      });
      await context.addInitScript((t) => {
        try {
          localStorage.setItem("motoxplus-theme", t);
        } catch {}
      }, theme);
      const page = await context.newPage();
      const dir = path.join(SHOTS_DIR, `${viewport.name}-${theme}`);
      fs.mkdirSync(dir, { recursive: true });
      for (const route of routes) {
        try {
          await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20000 });
          await page.waitForTimeout(350); // let theme-toggle mount-guard / fonts settle
          await page.screenshot({ path: path.join(dir, `${safeName(route)}.png`), fullPage: true });
          ok++;
        } catch (e) {
          failed++;
          console.log(`  ERROR [${label}] ${viewport.name}/${theme}${route}: ${e.message.split("\n")[0]}`);
        }
      }
      await context.close();
    }
  }
  return { ok, failed };
}

async function main() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch();
  const summary = [];

  console.log(`Shooting PUBLIC routes -> ${SHOTS_DIR}`);
  summary.push(["public", await shootRoutes(browser, PUBLIC_ROUTES, undefined, "public")]);

  for (const [role, routes] of [
    ["dealer", DEALER_ROUTES],
    ["vendor", VENDOR_ROUTES],
    ["admin", ADMIN_ROUTES],
  ]) {
    try {
      const { state, loggedIn } = await login(browser, role);
      if (!loggedIn) {
        console.log(`  WARN: ${role} login did not redirect away from /login — check test credentials/seed data.`);
      }
      console.log(`Shooting ${role.toUpperCase()} routes...`);
      summary.push([role, await shootRoutes(browser, routes, state, role)]);
    } catch (e) {
      console.log(`  ERROR: ${role} login/shots failed: ${e.message}`);
      summary.push([role, { ok: 0, failed: routes.length * VIEWPORTS.length * THEMES.length }]);
    }
  }

  await browser.close();

  console.log("\n=== SUMMARY ===");
  let totalOk = 0;
  let totalFailed = 0;
  for (const [label, { ok, failed }] of summary) {
    console.log(`  ${label}: ${ok} ok, ${failed} failed`);
    totalOk += ok;
    totalFailed += failed;
  }
  console.log(`Total: ${totalOk} ok, ${totalFailed} failed. Shots in ${SHOTS_DIR}`);
  process.exit(totalFailed > 0 && totalOk === 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
