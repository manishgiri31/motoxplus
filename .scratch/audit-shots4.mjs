import { chromium } from "playwright";
const OUT = "E:/motoxplus/motoxplus-web/.scratch/audit-shots";
const browser = await chromium.launch();

const pages = [
  { path: "/", name: "home-live" },
  { path: "/products", name: "products-live" },
  { path: "/vehicles", name: "vehicles-live" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const p of pages) {
    try {
      await page.goto(`http://localhost:3000${p.path}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${p.name}-${vp.name}.png`, fullPage: true });
      console.log(`OK ${p.name} ${vp.name}`);
    } catch (e) {
      console.log(`FAIL ${p.name} ${vp.name}: ${e.message}`);
    }
  }
  await context.close();
}

// grab a product detail and vehicle detail page too, using first real slugs
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
try {
  await page2.goto("http://localhost:3000/products", { waitUntil: "networkidle", timeout: 30000 });
  const href = await page2.locator('a[href^="/products/"]').first().getAttribute("href");
  if (href) {
    await page2.goto(`http://localhost:3000${href}`, { waitUntil: "networkidle", timeout: 30000 });
    await page2.waitForTimeout(500);
    await page2.screenshot({ path: `${OUT}/product-detail-live.png`, fullPage: true });
    console.log("OK product-detail-live", href);
  } else {
    console.log("FAIL no product link found");
  }
} catch (e) {
  console.log("FAIL product-detail-live: " + e.message);
}

try {
  await page2.goto("http://localhost:3000/vehicles", { waitUntil: "networkidle", timeout: 30000 });
  const href = await page2.locator('a[href^="/vehicles/"]').first().getAttribute("href");
  if (href && href !== "/vehicles") {
    await page2.goto(`http://localhost:3000${href}`, { waitUntil: "networkidle", timeout: 30000 });
    await page2.waitForTimeout(500);
    await page2.screenshot({ path: `${OUT}/vehicle-detail-live.png`, fullPage: true });
    console.log("OK vehicle-detail-live", href);
  } else {
    console.log("FAIL no vehicle detail link found");
  }
} catch (e) {
  console.log("FAIL vehicle-detail-live: " + e.message);
}
await ctx2.close();

await browser.close();
console.log("DONE");
