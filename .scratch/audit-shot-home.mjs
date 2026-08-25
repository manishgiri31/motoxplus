import { chromium } from "playwright";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/home-desktop.png", fullPage: true });
console.log("OK home desktop");
await browser.close();
