import { chromium } from "playwright";
const S = "C:/Users/Manish/AppData/Local/Temp/claude/e--motoxplus-motoxplus-web/7b64fe97-32c1-4163-9a63-6847b54bdb1e/scratchpad/";
const b = await chromium.launch();
for (const path of process.argv.slice(2)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  try {
    const r = await p.goto("http://localhost:3100/" + path, { waitUntil: "networkidle", timeout: 90000 });
    await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,120));} window.scrollTo(0,0); });
    await p.waitForTimeout(600);
    await p.screenshot({ path: S + "pg" + path.replace(/\W+/g,"_") + ".png", fullPage: true });
    console.log(path, r.status());
  } catch (e) { console.log(path, "ERR", e.message.slice(0,100)); }
  await p.close();
}
await b.close();
