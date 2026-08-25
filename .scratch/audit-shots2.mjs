import { chromium } from "playwright";
const OUT = "E:/motoxplus/motoxplus-web/.scratch/audit-shots";
const browser = await chromium.launch();

const pages = [
  { path: "/about", name: "about2" },
  { path: "/become-dealer", name: "become-dealer2" },
  { path: "/products", name: "products2" },
  { path: "/vehicles", name: "vehicles2" },
  { path: "/contact", name: "contact2" },
];

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
for (const p of pages) {
  try {
    await page.goto(`http://localhost:3000${p.path}`, { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${p.name}-desktop.png`, fullPage: true });
    console.log(`OK ${p.name}`);
  } catch (e) {
    console.log(`FAIL ${p.name}: ${e.message}`);
  }
}
await ctx.close();

// mobile home
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
await mpage.goto("http://localhost:3000/", { waitUntil: "load", timeout: 20000 });
const h = await mpage.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 400) { await mpage.evaluate((y) => window.scrollTo(0, y), y); await mpage.waitForTimeout(120); }
await mpage.evaluate(() => window.scrollTo(0, 0));
await mpage.waitForTimeout(300);
await mpage.screenshot({ path: `${OUT}/home-mobile2.png`, fullPage: true });
console.log("OK home-mobile2");
await mctx.close();

// dark mode home
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const dpage = await dctx.newPage();
await dpage.goto("http://localhost:3000/", { waitUntil: "load", timeout: 20000 });
await dpage.waitForTimeout(500);
await dpage.screenshot({ path: `${OUT}/home-dark.png`, fullPage: false });
console.log("OK home-dark");
await dctx.close();

await browser.close();
console.log("DONE");
