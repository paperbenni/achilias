import { chromium, type Browser } from "playwright";
import { CookieJar } from "tough-cookie";
import { saveSession, readSession, type Session } from "./session";
import { parsePage } from "./parser";
const globalJobs = globalThis as typeof globalThis & {
  achiliasLoginJobs?: Map<string, Browser | null>;
};
const jobs = (globalJobs.achiliasLoginJobs ||= new Map());
export async function cancelLogin(id: string) {
  const browser = jobs.get(id);
  jobs.delete(id);
  await browser?.close().catch(() => {});
}
export function beginLogin(session: Session) {
  jobs.set(session.id, null);
  void runLogin(session);
}
async function runLogin(session: Session) {
  let browser: Browser | undefined;
  try {
    if (jobs.size > 3)
      throw new Error(
        "There are too many sign-in windows. Close one and try again.",
      );
    browser = await chromium.launch({
      headless: process.env.ACHILIAS_LOGIN_HEADLESS === "true",
      ...(process.env.ACHILIAS_BROWSER_PATH
        ? { executablePath: process.env.ACHILIAS_BROWSER_PATH }
        : {}),
    });
    if (!jobs.has(session.id)) {
      await browser.close();
      return;
    }
    jobs.set(session.id, browser);
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(
      new URL("login.php?cmd=force_login", session.instance).href,
    );
    const deadline = Date.now() + 5 * 60_000;
    let authenticated = false;
    while (Date.now() < deadline && jobs.has(session.id) && !page.isClosed()) {
      if (page.url().startsWith(session.instance)) {
        try {
          const parsed = parsePage(await page.content(), page.url());
          if (parsed.authenticated) {
            authenticated = true;
            session.userName = parsed.userName;
            break;
          }
        } catch {
          /* Navigation can replace the page while SSO redirects. Retry. */
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (!authenticated)
      throw new Error(
        "Sign-in was cancelled or timed out. Try connecting again.",
      );
    const jar = new CookieJar();
    // The university identity-provider cookies remain in this temporary browser.
    for (const c of await context.cookies(session.instance)) {
      const domain = c.domain.replace(/^\./, "");
      // Do not copy broad university SSO cookies to the ILIAS adapter.
      if (domain !== new URL(session.instance).hostname) continue;
      await jar.setCookie(
        `${c.name}=${c.value}; Path=${c.path}${c.secure ? "; Secure" : ""}${c.httpOnly ? "; HttpOnly" : ""}${c.expires > 0 ? `; Expires=${new Date(c.expires * 1000).toUTCString()}` : ""}`,
        session.instance,
      );
    }
    if (!jobs.has(session.id) || !(await readSession(session.id))) return;
    session.jar = jar.serializeSync();
    session.status = "connected";
    await saveSession(session);
  } catch {
    // Library errors can contain URLs and browser data. Return a fixed, useful message.
    if (jobs.has(session.id) && (await readSession(session.id))) {
      session.status = "failed";
      session.error =
        "Sign-in could not finish. Keep the university browser open until you reach ILIAS. If no window appeared, run bun run browser:install and ensure this server has a desktop display. You can also use the session import command in the README.";
      await saveSession(session);
    }
  } finally {
    jobs.delete(session.id);
    await browser?.close().catch(() => {});
  }
}
