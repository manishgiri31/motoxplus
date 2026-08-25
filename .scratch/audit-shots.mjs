import { chromium } from "playwright";
import fs from "fs";

const OUT = "E:/motoxplus/motoxplus-web/.scratch/audit-shots";
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  { path: "/", name: "home" },
  { path: "/products", name: "products" },
  { path: "/vehicles", name: "vehicles" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
  { path: "/become-dealer", name: "become-dealer" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const p of pages) {
    try {
      await page.goto(`http://localhost:3000${p.path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${p.name}-${vp.name}.png`, fullPage: true });
      console.log(`OK ${p.name} ${vp.name}`);
    } catch (e) {
      console.log(`FAIL ${p.name} ${vp.name}: ${e.message}`);
    }
  }
  await context.close();
}

await browser.close();
console.log("DONE");
