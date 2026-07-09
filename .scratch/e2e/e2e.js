// Minimal repl-like driver: node e2e.js <script.json>
// script.json is an array of steps: {action, ...args}
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

async function run(steps) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) console.log('NAVIGATED:', frame.url());
  });
  page.on('request', (req) => {
    if (req.url().includes('/products')) console.log('REQUEST:', req.method(), req.url());
    if (req.url().includes('/admin')) console.log('ADMINREQ:', req.method(), req.url());
    if (req.url().includes('/dealer/dashboard') || req.url().includes('/login')) {
      req.allHeaders().then((h) => console.log('REQ', req.method(), req.url(), 'cookie:', h['cookie'] || '(none)')).catch(() => {});
    }
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('download', (dl) => console.log('DOWNLOAD:', dl.suggestedFilename()));
  const netErrors = [];
  page.on('response', (res) => {
    if (res.status() >= 400) netErrors.push(`${res.status()} ${res.url()}`);
    if (res.url().includes('/admin')) console.log('ADMINRESP:', res.status(), res.url());
    if (res.url().includes('/api/auth/callback/credentials') || res.url().includes('/api/auth/session') || res.url().includes('/dealer/dashboard') || res.url().includes('/login')) {
      res.headersArray().then((arr) => {
        const cookies = arr.filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
        console.log('RESP', res.status(), res.url(), 'set-cookie:', cookies.length ? JSON.stringify(cookies) : '(none)');
      }).catch(() => {});
    }
  });

  let shotCount = 0;
  for (const step of steps) {
    try {
      if (step.action === 'goto') {
        await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } else if (step.action === 'waitFor') {
        await page.waitForSelector(step.selector, { timeout: step.timeout || 15000, state: step.state || 'visible' });
      } else if (step.action === 'waitForText') {
        await page.getByText(step.text, { exact: false }).first().waitFor({ timeout: step.timeout || 15000 });
      } else if (step.action === 'click') {
        await page.click(step.selector, { timeout: step.timeout || 10000 });
      } else if (step.action === 'clickText') {
        await page.getByText(step.text, { exact: step.exact || false }).first().click({ timeout: step.timeout || 10000 });
      } else if (step.action === 'fill') {
        await page.fill(step.selector, step.value, { timeout: step.timeout || 10000 });
      } else if (step.action === 'press') {
        await page.keyboard.press(step.key);
      } else if (step.action === 'wait') {
        await page.waitForTimeout(step.ms);
      } else if (step.action === 'screenshot') {
        shotCount++;
        const name = step.name || `shot-${shotCount}`;
        await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: step.fullPage !== false });
        console.log('SCREENSHOT:', path.join(SHOT_DIR, `${name}.png`));
      } else if (step.action === 'log') {
        console.log('URL:', page.url());
      } else if (step.action === 'type') {
        await page.type(step.selector, step.value, { delay: step.delay || 80 });
      } else if (step.action === 'cookies') {
        const cookies = await context.cookies();
        console.log('COOKIES:', JSON.stringify(cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure }))));
      } else if (step.action === 'eval') {
        const result = await page.evaluate(step.fn);
        console.log('EVAL RESULT:', JSON.stringify(result));
      }
      console.log('OK:', JSON.stringify(step));
    } catch (e) {
      console.log('STEP FAILED:', JSON.stringify(step), '->', e.message);
    }
  }

  console.log('--- CONSOLE ERRORS ---');
  consoleErrors.forEach((e) => console.log(e));
  console.log('--- PAGE ERRORS ---');
  pageErrors.forEach((e) => console.log(e));
  console.log('--- NETWORK ERRORS (>=400) ---');
  netErrors.forEach((e) => console.log(e));

  await browser.close();
}

const scriptPath = process.argv[2];
const steps = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
run(steps).catch((e) => { console.error('FATAL', e); process.exit(1); });
