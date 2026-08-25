import { chromium } from "playwright";
const OUT = "E:/motoxplus/motoxplus-web/.scratch/audit-shots";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pages = [
  { path: "/privacy", name: "privacy3" },
  { path: "/become-vendor", name: "become-vendor3" },
  { path: "/products/some-slug", name: "product-detail3" },
  { path: "/vehicles/motorcycle/some-slug", name: "vehicle-detail3" },
];
for (const p of pages) {
  try {
    await page.goto(`http://localhost:3000${p.path}`, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${p.name}.png`, fullPage: true });
    console.log(`OK ${p.name}`);
  } catch (e) {
    console.log(`FAIL ${p.name}: ${e.message}`);
  }
}
await ctx.close();
await browser.close();
console.log("DONE");
