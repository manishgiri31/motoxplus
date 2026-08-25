import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/login", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/login2.png", fullPage: true });
console.log("OK login");
await browser.close();
