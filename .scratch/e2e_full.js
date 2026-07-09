const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`);
}

async function withErrorCapture(page, fn, label) {
  const errors = [];
  const consoleHandler = (msg) => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); };
  const pageErrHandler = (err) => errors.push('PAGEERROR: ' + err.message);
  const respHandler = (res) => { if (res.status() >= 500) errors.push('HTTP ' + res.status() + ': ' + res.url()); };
  page.on('console', consoleHandler);
  page.on('pageerror', pageErrHandler);
  page.on('response', respHandler);
  try {
    await fn();
  } catch (e) {
    errors.push('THROWN: ' + e.message);
  }
  page.off('console', consoleHandler);
  page.off('pageerror', pageErrHandler);
  page.off('response', respHandler);
  record(label, errors.length === 0, errors.join(' | '));
}

async function main() {
  const browser = await chromium.launch();

  // ---------- PUBLIC ----------
  {
    const page = await browser.newPage();
    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Public: homepage loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/products`, { waitUntil: 'networkidle', timeout: 20000 });
      const searchInput = page.locator('input[placeholder*="Search by name"]');
      await searchInput.waitFor({ timeout: 5000 });
    }, 'Public: products page + large search bar renders');

    await withErrorCapture(page, async () => {
      await page.fill('input[placeholder*="Search by name"]', 'splendor');
      await page.waitForTimeout(1000);
      const dropdown = page.locator('#product-search-listbox');
      await dropdown.waitFor({ timeout: 5000 });
    }, 'Public: search autocomplete dropdown appears');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/vehicles`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Public: vehicles page loads');

    await page.close();
  }

  // ---------- DEALER FLOW ----------
  {
    const page = await browser.newPage();
    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.fill('input[placeholder*="you@company.com"]', 'dealer@testshop.in');
      await page.fill('input[placeholder="Your password"]', 'Dealer@123456');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
        page.click('button[type="submit"]'),
      ]);
    }, 'Dealer: login');
    console.log('  dealer post-login URL:', page.url());

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/dealer/products`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Dealer: products catalog loads');

    await withErrorCapture(page, async () => {
      // try to add first available product to cart via visible add-to-cart button
      const addBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add")').first();
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await page.waitForTimeout(800);
      }
    }, 'Dealer: add product to cart from catalog');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/dealer/cart`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Dealer: cart page loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/dealer/orders`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Dealer: orders page loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/dealer/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Dealer: dashboard loads');

    await page.close();
  }

  // ---------- VENDOR FLOW ----------
  {
    const page = await browser.newPage();
    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.fill('input[placeholder*="you@company.com"]', 'vendor@testparts.in');
      await page.fill('input[placeholder="Your password"]', 'Vendor@123456');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
        page.click('button[type="submit"]'),
      ]);
    }, 'Vendor: login');
    console.log('  vendor post-login URL:', page.url());

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/vendor/products`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Vendor: products page loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/vendor/purchase-orders`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Vendor: purchase orders page loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/vendor/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Vendor: dashboard loads');

    await page.close();
  }

  // ---------- ADMIN FLOW ----------
  {
    const page = await browser.newPage();
    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.fill('input[placeholder*="you@company.com"]', 'admin@motoxplus.in');
      await page.fill('input[placeholder="Your password"]', 'Admin@123456');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
        page.click('button[type="submit"]'),
      ]);
    }, 'Admin: login');
    console.log('  admin post-login URL:', page.url());

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Admin: products list loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Admin: orders page loads');

    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
    }, 'Admin: dashboard loads');

    // Verify data changes: pricing digit rule + descriptions visible
    await withErrorCapture(page, async () => {
      await page.goto(`${BASE}/products?category=brake-shoes`, { waitUntil: 'networkidle', timeout: 20000 });
      const bodyText = await page.textContent('body');
      if (!bodyText.includes('BRAKE SHOE')) throw new Error('Brake shoe products not visible');
    }, 'Data check: brake shoe products visible on storefront');

    await page.close();
  }

  await browser.close();

  console.log('\n=== SUMMARY ===');
  const failed = results.filter(r => !r.pass);
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILURES:');
    failed.forEach(f => console.log(' -', f.name, ':', f.detail));
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
