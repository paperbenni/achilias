import { readFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Rasterize the existing vector mark; the solid square is safe for OS masks.
const svg = (await readFile("src/app/icon.svg", "utf8")).replace('rx="12"', 'rx="0"');
await mkdir("public/icons", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [size, name] of [[192, "app-192"], [512, "app-512"], [180, "apple-touch-icon"]] as const) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.locator("svg").screenshot({ path: `public/icons/${name}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
