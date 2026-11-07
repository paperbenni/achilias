import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import {
  dashboardUrl,
  FREIBURG,
  normalizeInstance,
} from "../src/lib/ilias/config";
import { browserLogin } from "./browser-login.mts";
import { importInstanceCookies } from "../src/lib/ilias/cookie-import";
import { configuredOrigin } from "../src/lib/ilias/origin";
import { remoteRequest, remoteServerUrl } from "../src/lib/ilias/remote-client";

export type ConnectOptions = {
  server?: string;
  instance?: string;
  cookies?: string;
  proxy?: string;
  app?: string;
};

export async function runConnect(options: ConnectOptions) {
  const { server, cookies: cookieFile } = options;
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
      options.instance &&
      normalizeInstance(options.instance) !== instance
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
        throw new Error("The connection code expired. Start again in Achilias.");
      cookies = (
        await browserLogin(instance, {
          proxy: options.proxy,
          timeoutMs: Math.min(remaining, 5 * 60_000),
        })
      ).cookies;
    }
    await remoteRequest(origin, code, cookies);
    console.log(
      "Connected. Return to Achilias; the page will update automatically.",
    );
    return;
  }
  const instance = normalizeInstance(options.instance || FREIBURG);
  const app = remoteServerUrl(
    options.app || configuredOrigin() || "http://127.0.0.1:3000",
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
    session.userName = (await fetchPage(session, dashboardUrl(instance)))
      .userName;
  } else {
    console.log("Complete university sign-in in the browser window.");
    const result = await browserLogin(instance, {
      proxy: options.proxy,
    });
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
