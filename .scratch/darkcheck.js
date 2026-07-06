const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => localStorage.setItem('motoxplus-theme', 'dark'));
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  console.log('html class:', htmlClass);
  await page.screenshot({ path: 'E:/tmp/dark-home2.png', fullPage: false });

  await page.goto('http://localhost:3000/products', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'E:/tmp/dark-products2.png', fullPage: false });

  await browser.close();
})();
