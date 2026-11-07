import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import {
  dashboardUrl,
  FREIBURG,
  normalizeInstance,
} from "../src/lib/ilias/config";
import { browserLogin } from "./browser-login";
import { importInstanceCookies } from "../src/lib/ilias/cookie-import";
import { configuredOrigin } from "../src/lib/ilias/origin";
import { remoteRequest, remoteServerUrl } from "../src/lib/ilias/remote-client";
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
if (args.includes("--help")) {
  console.log(`bun run connect [--instance https://ilias.uni-freiburg.de/] [--cookies /path/to/cookies.json] [--app http://127.0.0.1:3000]
bun run connect --server https://your-achilias.example [--cookies /path/to/cookies.json] [--proxy socks5://127.0.0.1:1080]

Without --server, run on the same computer/data directory as Achilias. A local browser opens for university sign-in, or --cookies imports an existing export. The command prints a single-use browser connection link.
With --server, run on your laptop. Paste the temporary code from the server's connection dialog when prompted. The helper signs in locally and transfers only ILIAS cookies over HTTPS or loopback HTTP. No shared filesystem, server display, or server Chromium is needed. Use --proxy with an SSH SOCKS tunnel if ILIAS binds sessions to the login IP.
The connection code is read from stdin and is never passed as a command-line argument.`);
  process.exit(0);
}
try {
  const server = option("--server");
  const cookieFile = option("--cookies");
  if (server) {
    const origin = remoteServerUrl(server);
    console.log(`Connecting to ${origin}`);
    let code: string;
    if (process.stdin.isTTY) {
      const prompt = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        code = (
          await prompt.question("Paste the connection code from Achilias: ")
        ).trim();
      } finally {
        prompt.close();
      }
    } else {
      let input = "";
      for await (const chunk of process.stdin) {
        input += chunk.toString();
        if (input.length > 256) throw new Error("Invalid connection code.");
      }
      code = input.trim();
    }
    const metadata = await remoteRequest(origin, code);
    const instance = normalizeInstance(metadata.instance);
    if (
      option("--instance") &&
      normalizeInstance(option("--instance")!) !== instance
    )
      throw new Error(
        "The selected instance does not match this server connection.",
      );
    console.log(`University sign-in: ${instance}`);
    let cookies: unknown;
    if (cookieFile) {
      const data = JSON.parse(await readFile(cookieFile, "utf8"));
      await importInstanceCookies(data, instance);
      const values = Array.isArray(data) ? data : data.cookies;
      cookies = values
        .filter(
          (cookie: { domain: string }) =>
            cookie.domain.replace(/^\./, "") === new URL(instance).hostname,
        )
        .map((cookie: Record<string, unknown>) =>
          Object.fromEntries(
            ["name", "value", "domain", "path", "secure", "httpOnly", "expires"]
              .filter((k) => cookie[k] !== undefined)
              .map((k) => [k, cookie[k]]),
          ),
        );
    } else {
      console.log("Complete myLogin in the browser on this computer.");
      const remaining = metadata.expiresAt - Date.now();
      if (remaining <= 0)
        throw new Error(
          "The connection code expired. Start again in Achilias.",
        );
      cookies = (
        await browserLogin(instance, {
          proxy: option("--proxy"),
          timeoutMs: Math.min(remaining, 5 * 60_000),
        })
      ).cookies;
    }
    await remoteRequest(origin, code, cookies);
    console.log(
      "Connected. Return to Achilias; the page will update automatically.",
    );
  } else {
    const instance = normalizeInstance(option("--instance") || FREIBURG);
    const app = remoteServerUrl(
      option("--app") || configuredOrigin() || "http://127.0.0.1:3000",
    );
    const sessions = await import("../src/lib/ilias/session");
    const { newPairing } = await import("../src/lib/ilias/pairing");
    const { fetchPage } = await import("../src/lib/ilias/client");
    const session: import("../src/lib/ilias/session").Session = {
      id: randomUUID(),
      instance,
      status: "pending",
      createdAt: Date.now(),
    };
    if (cookieFile) {
      session.jar = await importInstanceCookies(
        JSON.parse(await readFile(cookieFile, "utf8")),
        instance,
      );
      session.userName = (
        await fetchPage(session, dashboardUrl(instance))
      ).userName;
    } else {
      console.log("Complete university sign-in in the browser window.");
      const result = await browserLogin(instance, { proxy: option("--proxy") });
      session.jar = result.jar;
      session.userName = result.userName;
    }
    session.status = "connected";
    const pairing = newPairing();
    session.pairing = { digest: pairing.digest, expiresAt: pairing.expiresAt };
    await sessions.saveSession(session);
    console.log(
      `Open this single-use link within five minutes:\n${app}/connect#${session.id}.${pairing.secret}`,
    );
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : "Connection failed.");
  process.exit(1);
}
