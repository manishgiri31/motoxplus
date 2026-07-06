const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => localStorage.setItem('motoxplus-theme', 'dark'));
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1500);

  const diag = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const rootStyles = getComputedStyle(html);
    const bodyStyles = getComputedStyle(body);
    return {
      htmlClass: html.className,
      bodyClass: body.className,
      htmlDataAttrs: html.getAttributeNames().map(n => `${n}=${html.getAttribute(n)}`),
      bgPrimaryVarOnHtml: rootStyles.getPropertyValue('--bg-primary'),
      bgPrimaryVarOnBody: bodyStyles.getPropertyValue('--bg-primary'),
      bodyBackgroundColor: bodyStyles.backgroundColor,
      bodyColor: bodyStyles.color,
    };
  });
  console.log(JSON.stringify(diag, null, 2));
  await browser.close();
})();
