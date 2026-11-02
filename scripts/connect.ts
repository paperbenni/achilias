import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { CookieJar } from "tough-cookie";
import { assertInstance, FREIBURG } from "../src/lib/ilias/config";
import {
  readSession,
  saveSession,
  type Session,
} from "../src/lib/ilias/session";
import { beginLogin } from "../src/lib/ilias/login";
import { fetchPage } from "../src/lib/ilias/client";
import { newPairing } from "../src/lib/ilias/pairing";

const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
if (args.includes("--help")) {
  console.log(
    "bun run connect [--instance https://ilias.uni-freiburg.de/] [--cookies /path/to/cookies.json] [--app http://127.0.0.1:3000]\nWithout --cookies, opens the real university sign-in in a local browser. With --cookies, imports a Playwright storageState or an exported cookie array. Run from the same checkout and with the same ACHILIAS_DATA_DIR as the server.",
  );
  process.exit(0);
}
try {
  const instance = assertInstance(option("--instance") || FREIBURG);
  const app = new URL(
    option("--app") || process.env.ACHILIAS_ORIGIN || "http://127.0.0.1:3000",
  );
  const session: Session = {
    id: randomUUID(),
    instance,
    status: "pending",
    createdAt: Date.now(),
  };
  const cookieFile = option("--cookies");
  if (cookieFile) {
    const data = JSON.parse(await readFile(cookieFile, "utf8"));
    const values = Array.isArray(data) ? data : data.cookies;
    if (!Array.isArray(values) || values.length > 1000)
      throw new Error("Expected a Playwright storageState or a cookie array.");
    const jar = new CookieJar();
    for (const c of values) {
      if (
        typeof c.domain !== "string" ||
        c.domain.replace(/^\./, "") !== new URL(instance).hostname
      )
        continue;
      if (
        typeof c.name !== "string" ||
        typeof c.value !== "string" ||
        /[;\r\n]/.test(c.name + c.value)
      )
        throw new Error("Invalid cookie data.");
      await jar.setCookie(
        `${c.name}=${c.value}; Path=${typeof c.path === "string" ? c.path : "/"}${c.secure ? "; Secure" : ""}${c.httpOnly ? "; HttpOnly" : ""}${c.expires > 0 ? `; Expires=${new Date(c.expires * 1000).toUTCString()}` : ""}`,
        instance,
      );
    }
    session.jar = jar.serializeSync();
    const page = await fetchPage(
      session,
      new URL("ilias.php?baseClass=ilDashboardGUI", instance).href,
    );
    session.userName = page.userName;
    session.status = "connected";
    await saveSession(session);
  } else {
    await saveSession(session);
    beginLogin(session);
    console.log("Complete university sign-in in the browser window.");
    while (true) {
      await new Promise((r) => setTimeout(r, 1000));
      const current = await readSession(session.id);
      if (!current || current.status === "failed")
        throw new Error(
          "Sign-in did not finish. Ensure a desktop display and Chromium are available.",
        );
      if (current.status === "connected") {
        Object.assign(session, current);
        break;
      }
    }
  }
  const pairing = newPairing();
  session.pairing = { digest: pairing.digest, expiresAt: pairing.expiresAt };
  await saveSession(session);
  console.log(
    `Open this single-use link within five minutes:\n${app.origin}/connect#${session.id}.${pairing.secret}`,
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Connection failed.");
  process.exit(1);
}
