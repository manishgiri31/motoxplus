import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 20000 });
await page.waitForTimeout(500);
// click theme toggle (moon icon button in navbar)
const toggle = await page.locator('button[aria-label*="theme" i], button:has(svg)').first();
await page.getByRole("button", { name: /theme|dark|light/i }).click({ timeout: 3000 }).catch(async () => {
  // fallback: find the button next to Login containing a moon/sun icon — it's the only icon-only button pre-hamburger
  const buttons = await page.locator("header button").all();
  for (const b of buttons) {
    const box = await b.boundingBox();
    if (box && box.width < 50 && box.height < 50) { await b.click(); break; }
  }
});
await page.waitForTimeout(400);
await page.screenshot({ path: "E:/motoxplus/motoxplus-web/.scratch/audit-shots/home-dark-toggled.png", fullPage: false });
console.log("OK");
await browser.close();
