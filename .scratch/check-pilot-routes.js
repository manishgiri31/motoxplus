const { chromium } = require("playwright");
const path = require("path");

const BASE = "http://localhost:3000";
const OUT = path.join(__dirname, "shots", "pilot-check");

const CREDS = {
  admin: { email: "admin@motoxplus.in", password: "Admin@123456" },
  vendor: { email: "vendor@testparts.in", password: "Vendor@123456" },
};

async function login(browser, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (msg) => msg.type() === "error" && errors.push("CONSOLE: " + msg.text()));
  page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 });
  await page.fill('input[placeholder*="you@company.com"]', CREDS[role].email);
  await page.fill('input[placeholder="Your password"]', CREDS[role].password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  return { page, context, errors, loggedIn: !page.url().includes("/login") };
}

async function main() {
  const fs = require("fs");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  const { page: adminPage, context: adminCtx, errors: adminErrors, loggedIn: adminOk } = await login(browser, "admin");
  console.log("admin logged in:", adminOk);

  for (const [route, name] of [
    ["/admin/dashboard", "admin-dashboard"],
    ["/admin/crm/leads", "admin-crm-leads"],
  ]) {
    try {
      await adminPage.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 20000 });
      await adminPage.waitForTimeout(300);
      await adminPage.screenshot({ path: path.join(OUT, `${name}-light.png`), fullPage: true });
      await adminPage.evaluate(() => localStorage.setItem("motoxplus-theme", "dark"));
      await adminPage.reload({ waitUntil: "networkidle", timeout: 20000 });
      await adminPage.waitForTimeout(300);
      await adminPage.screenshot({ path: path.join(OUT, `${name}-dark.png`), fullPage: true });
      await adminPage.evaluate(() => localStorage.setItem("motoxplus-theme", "light"));
      console.log(`shot ${name} OK`);
    } catch (e) {
      console.log(`ERROR shooting ${name}: ${e.message}`);
    }
  }
  console.log("admin console/page errors:", adminErrors.length ? adminErrors.join(" | ") : "none");
  await adminCtx.close();

  const { page: vendorPage, context: vendorCtx, errors: vendorErrors, loggedIn: vendorOk } = await login(browser, "vendor");
  console.log("vendor logged in:", vendorOk);
  try {
    await vendorPage.goto(`${BASE}/vendor/purchase-orders`, { waitUntil: "networkidle", timeout: 20000 });
    await vendorPage.waitForTimeout(300);
    await vendorPage.screenshot({ path: path.join(OUT, "vendor-purchase-orders-light.png"), fullPage: true });
    await vendorPage.evaluate(() => localStorage.setItem("motoxplus-theme", "dark"));
    await vendorPage.reload({ waitUntil: "networkidle", timeout: 20000 });
    await vendorPage.waitForTimeout(300);
    await vendorPage.screenshot({ path: path.join(OUT, "vendor-purchase-orders-dark.png"), fullPage: true });
    console.log("shot vendor-purchase-orders OK");
  } catch (e) {
    console.log(`ERROR shooting vendor-purchase-orders: ${e.message}`);
  }
  console.log("vendor console/page errors:", vendorErrors.length ? vendorErrors.join(" | ") : "none");
  await vendorCtx.close();

  await browser.close();
  console.log("Done. Shots in", OUT);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
