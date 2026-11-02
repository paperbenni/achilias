import type { Browser } from "playwright";
import { browserLogin } from "./browser-login";
import { isLoopbackHostname } from "./loopback";
import {
  saveSession,
  readSession,
  withSessionLock,
  type Session,
} from "./session";
const globalJobs = globalThis as typeof globalThis & {
  achiliasLoginJobs?: Map<string, Browser | null>;
};
const jobs = (globalJobs.achiliasLoginJobs ||= new Map());
export function serverLoginMode(): "local" | "remote" {
  // A browser on a public server must never be exposed as a shared sign-in UI.
  const origin = process.env.ACHILIAS_ORIGIN;
  if (
    origin &&
    !isLoopbackHostname(new URL(origin).hostname)
  )
    return "remote";
  const configured = process.env.ACHILIAS_LOGIN_MODE;
  if (configured === "local" || configured === "remote") return configured;
  return process.platform === "linux" &&
    !process.env.DISPLAY &&
    !process.env.WAYLAND_DISPLAY
    ? "remote"
    : "local";
}
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
  try {
    if (jobs.size > 3) throw new Error("Too many sign-in windows.");
    const result = await browserLogin(session.instance, {
      onBrowser: (browser) => {
        if (!jobs.has(session.id)) {
          void browser.close();
          return;
        }
        jobs.set(session.id, browser);
      },
    });
    await finishLogin(session.id, {
      jar: result.jar,
      userName: result.userName,
      status: "connected",
    });
  } catch {
    await finishLogin(session.id, {
      status: "failed",
      error:
        "Sign-in could not finish. Keep the university browser open until you reach ILIAS. If this server has no desktop, choose “On my computer” and use the local helper. For a server browser, install Chromium with bun run browser:install.",
    });
  } finally {
    jobs.delete(session.id);
  }
}

async function finishLogin(
  id: string,
  result:
    | { status: "connected"; jar: Session["jar"]; userName: string }
    | { status: "failed"; error: string },
) {
  await withSessionLock(id, async () => {
    const current = await readSession(id);
    if (!jobs.has(id) || current?.status !== "pending") return;
    await saveSession({ ...current, ...result });
  });
}
