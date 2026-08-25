import { chromium } from "playwright";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(1000);
// scroll through in steps to trigger whileInView observers
const height = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < height; y += 400) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(150);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/home-desktop-scrolled.png", fullPage: true });
console.log("OK");
await browser.close();
