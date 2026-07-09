const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "app", "icon.png");
const OUT_ICO = path.join(__dirname, "..", "src", "app", "favicon.ico");
const OUT_APPLE = path.join(__dirname, "..", "src", "app", "apple-icon.png");
const OUT_APPLE_PUBLIC = path.join(__dirname, "..", "public", "apple-touch-icon.png");

async function pngBuffer(size) {
  return sharp(SRC).resize(size, size, { fit: "cover" }).png().toBuffer();
}

// Hand-build a valid multi-resolution ICO with embedded PNG frames
// (ICO PNG-frame format, supported by all modern browsers + Windows Vista+).
function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const dataBuffers = [];

  for (const { size, buffer } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    offset += buffer.length;
    dirEntries.push(entry);
    dataBuffers.push(buffer);
  }

  return Buffer.concat([header, ...dirEntries, ...dataBuffers]);
}

async function main() {
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    images.push({ size, buffer: await pngBuffer(size) });
  }
  const ico = buildIco(images);
  fs.writeFileSync(OUT_ICO, ico);
  console.log("favicon.ico written:", ico.length, "bytes");

  const apple = await sharp(SRC).resize(180, 180, { fit: "cover" }).png().toBuffer();
  fs.writeFileSync(OUT_APPLE, apple);
  fs.writeFileSync(OUT_APPLE_PUBLIC, apple);
  console.log("apple-icon written:", apple.length, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
