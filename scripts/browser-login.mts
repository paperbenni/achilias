import { createRequire } from "node:module";
import path from "node:path";
import { execa } from "execa";
import { chromium, type Browser } from "playwright-core";
import { loginUrl } from "../src/lib/ilias/config";
import { parsePage } from "../src/lib/ilias/parser";
import { importInstanceCookies } from "../src/lib/ilias/cookie-import";

async function installChromium() {
  const require = createRequire(import.meta.url);
  const packageJson = require.resolve("playwright-core/package.json");
  const cli = path.join(path.dirname(packageJson), "cli.js");
  try {
    await execa(process.execPath, [cli, "install", "chromium"], {
      stdio: "inherit",
    });
  } catch {
    throw new Error(
      "Could not install Chromium. Run `npx playwright install chromium` manually.",
    );
  }
}

function browserMissing(error: unknown) {
  return (
    error instanceof Error &&
    /Executable doesn't exist|playwright install|browser.*not found/i.test(
      error.message,
    )
  );
}

export async function browserLogin(
  instance: string,
  options: {
    onBrowser?: (browser: Browser) => void;
    proxy?: string;
    timeoutMs?: number;
  } = {},
) {
  const launch = () =>
    chromium.launch({
      headless: false,
      ...(process.env.ACHILIAS_BROWSER_PATH
        ? { executablePath: process.env.ACHILIAS_BROWSER_PATH }
        : {}),
      ...(options.proxy ? { proxy: { server: options.proxy } } : {}),
    });
  let browser: Browser;
  try {
    browser = await launch();
  } catch (error) {
    if (!browserMissing(error) || process.env.ACHILIAS_BROWSER_PATH)
      throw error;
    console.error(
      "Chromium is not installed. Downloading it once for the sign-in browser…",
    );
    await installChromium();
    browser = await launch();
  }
  try {
    options.onBrowser?.(browser);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(loginUrl(instance));
    const deadline = Date.now() + (options.timeoutMs || 5 * 60_000);
    while (Date.now() < deadline && !page.isClosed()) {
      if (page.url().startsWith(instance)) {
        try {
          const parsed = parsePage(await page.content(), page.url());
          if (parsed.authenticated) {
            const cookies = (await context.cookies(instance)).filter(
              (c) => c.domain.replace(/^\./, "") === new URL(instance).hostname,
            );
            return {
              cookies,
              jar: await importInstanceCookies(cookies, instance),
              userName: parsed.userName,
            };
          }
        } catch {
          /* The document may change during an SSO navigation. Retry. */
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    throw new Error("University sign-in was cancelled or timed out.");
  } finally {
    await browser.close().catch(() => {});
  }
}
