// Loads the 3 Phase-1 sufficiency-gate pages as their respective authenticated
// roles and reports console/page errors + a screenshot for visual review.
const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:3000";
const OUT = path.join(__dirname, "shots", "sufficiency-gate");

const CREDS = {
  admin: { email: "admin@motoxplus.in", password: "Admin@123456" },
  vendor: { email: "vendor@testparts.in", password: "Vendor@123456" },
};

async function login(browser, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 });
  await page.fill('input[placeholder*="you@company.com"]', CREDS[role].email);
  await page.fill('input[placeholder="Your password"]', CREDS[role].password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  return { context, page, loggedIn: !page.url().includes("/login") };
}

async function checkRoute(page, route, label) {
  const errors = [];
  const onConsole = (msg) => msg.type() === "error" && errors.push("CONSOLE: " + msg.text());
  const onErr = (err) => errors.push("PAGEERROR: " + err.message);
  const onResp = (res) => res.status() >= 500 && errors.push(`HTTP ${res.status()}: ${res.url()}`);
  page.on("console", onConsole);
  page.on("pageerror", onErr);
  page.on("response", onResp);

  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(500);
  const fs = require("fs");
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${label}.png`), fullPage: true });

  page.off("console", onConsole);
  page.off("pageerror", onErr);
  page.off("response", onResp);

  console.log(`${errors.length === 0 ? "PASS" : "FAIL"} - ${label} (${route})${errors.length ? " :: " + errors.join(" | ") : ""}`);
  return errors.length === 0;
}

async function main() {
  const browser = await chromium.launch();
  let allPass = true;

  const { context: adminCtx, page: adminPage, loggedIn: adminOk } = await login(browser, "admin");
  if (!adminOk) console.log("WARN: admin login did not succeed, url=" + adminPage.url());
  allPass = (await checkRoute(adminPage, "/admin/dashboard", "admin-dashboard")) && allPass;
  allPass = (await checkRoute(adminPage, "/admin/crm/leads", "admin-crm-leads")) && allPass;
  await adminCtx.close();

  const { context: vendorCtx, page: vendorPage, loggedIn: vendorOk } = await login(browser, "vendor");
  if (!vendorOk) console.log("WARN: vendor login did not succeed, url=" + vendorPage.url());
  allPass = (await checkRoute(vendorPage, "/vendor/purchase-orders", "vendor-purchase-orders")) && allPass;
  await vendorCtx.close();

  await browser.close();
  console.log(allPass ? "\nALL PASS" : "\nSOME FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
