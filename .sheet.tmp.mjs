import sharp from "sharp";
import fs from "fs";
const S = "C:/Users/Manish/AppData/Local/Temp/claude/e--motoxplus-motoxplus-web/7b64fe97-32c1-4163-9a63-6847b54bdb1e/scratchpad/";
const base = "https://pub-966fa80d99d64e388b250232523a507f.r2.dev/";
const keys = JSON.parse(fs.readFileSync(S + "r2keys.json", "utf8")).map(x => x[0]);
const own = keys.filter(k => /^products\/[0-9a-f-]{36}\.webp$/.test(k));
console.log("own originals:", own.length);
const start = Number(process.argv[2] || 0);
const pick = own.slice(start, start + 48);
const tiles = [];
for (const [i, k] of pick.entries()) {
  try {
    const r = await fetch(base + k.replace(".webp", "_med.webp")); const buf = Buffer.from(await r.arrayBuffer());
    const img = await sharp(buf).resize(200, 170, { fit: "contain", background: "#fff" }).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="16"><rect width="200" height="16" fill="#fff"/><text x="2" y="12" font-size="11" font-family="Arial">${start + i}</text></svg>`);
    tiles.push({ img, label });
  } catch (e) { console.log("fail", i, e.message); }
}
const cols = 8, rows = Math.ceil(tiles.length / cols);
const comp = [];
tiles.forEach((t, i) => { const x = (i % cols) * 200, y = Math.floor(i / cols) * 186; comp.push({ input: t.img, left: x, top: y }, { input: t.label, left: x, top: y + 170 }); });
await sharp({ create: { width: cols * 200, height: rows * 186, channels: 3, background: "#fff" } }).composite(comp).png().toFile(S + `own-${start}.png`);
