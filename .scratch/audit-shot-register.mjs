import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/register", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/register2.png", fullPage: true });
console.log("OK register");
await browser.close();
