import { readFile, mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Rasterize the existing vector mark; the solid square is safe for OS masks.
const original = await readFile("src/app/icon.svg", "utf8");
const svg = original.replace('rx="12"', 'rx="0"');
await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [size, name] of [[192, "app-192"], [512, "app-512"], [180, "apple-touch-icon"]] as const) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.locator("svg").screenshot({ path: `public/icons/${name}.png` });
    await page.close();
  }
  // Standard browser-tab fallback, with small native-size frames rather than
  // asking browsers to shrink the much larger PWA icons.
  const frames: Buffer[] = [];
  const sizes = [16, 32, 48];
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${original}`);
    const png = await page.locator("svg").screenshot({ omitBackground: true });
    frames.push(png);
    if (size === 32) await writeFile("public/icons/favicon-32.png", png);
    await page.close();
  }
  // ICO directory entries can contain PNG frames; no image dependency needed.
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  frames.forEach((png, index) => {
    const entry = 6 + index * 16;
    directory[entry] = sizes[index];
    directory[entry + 1] = sizes[index];
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile("src/app/favicon.ico", Buffer.concat([directory, ...frames]));
} finally {
  await browser.close();
}
