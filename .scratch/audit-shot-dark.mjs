import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.setItem("motoxplus-theme", "dark");
});
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/home-dark2.png", fullPage: false });
console.log("OK dark hero");

await page.goto("http://localhost:3000/about", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/about-dark2.png", fullPage: false });
console.log("OK dark about");

await browser.close();
