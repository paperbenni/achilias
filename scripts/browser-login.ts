import { chromium, type Browser } from "playwright";
import { loginUrl } from "../src/lib/ilias/config";
import { parsePage } from "../src/lib/ilias/parser";
import { importInstanceCookies } from "../src/lib/ilias/cookie-import";
export async function browserLogin(
  instance: string,
  options: {
    onBrowser?: (browser: Browser) => void;
    proxy?: string;
    timeoutMs?: number;
  } = {},
) {
  const browser = await chromium.launch({
    headless: false,
    ...(process.env.ACHILIAS_BROWSER_PATH
      ? { executablePath: process.env.ACHILIAS_BROWSER_PATH }
      : {}),
    ...(options.proxy ? { proxy: { server: options.proxy } } : {}),
  });
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
