import { expect, test } from "bun:test";
import {
  createPublicLookup,
  isPublicAddress,
  publicHostname,
  upstreamTransport,
  validatePublicAddresses,
} from "../src/lib/ilias/upstream-transport";
import { readUpstreamText } from "../src/lib/ilias/client";
import {
  readSmallJson,
  createSignInLimiter,
  withVerificationLimit,
} from "../src/lib/ilias/request-limits";
import { runWithIsolatedSessions } from "./helpers/isolated-sessions";

test("concurrent users have separate sessions, cookies, workspaces and action ownership", async () => {
  await runWithIsolatedSessions("tests/helpers/multi-user.ts");
});
test("only public unicast destinations are accepted, including IPv6 and mapped-address checks", () => {
  for (const value of [
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
    "::ffff:8.8.8.8",
    "2002:7f00:1::",
    "not-an-ip",
  ])
    expect(isPublicAddress(value)).toBe(false);
  for (const value of ["8.8.8.8", "132.230.1.1", "2606:4700:4700::1111"])
    expect(isPublicAddress(value)).toBe(true);
  for (const value of [
    "localhost",
    "127.0.0.1",
    "[::1]",
    "metadata.internal",
    "service.local",
    "host.lan",
    "singlelabel",
  ])
    expect(publicHostname(value)).toBe(false);
  expect(publicHostname("ilias.uni-freiburg.de")).toBe(true);
  expect(() =>
    validatePublicAddresses([
      { address: "8.8.8.8", family: 4 },
      { address: "10.1.1.1", family: 4 },
    ]),
  ).toThrow("public Internet");
});
test("the socket lookup pins its vetted DNS result and rechecks every new connection", async () => {
  let resolutions = 0;
  const lookup = createPublicLookup(async () => [
    { address: ++resolutions === 1 ? "8.8.8.8" : "127.0.0.1", family: 4 },
  ]);
  await new Promise<void>((resolve, reject) =>
    lookup("ilias.university.edu", { all: true }, (error, addresses) => {
      if (error) return reject(error);
      expect(addresses).toEqual([{ address: "8.8.8.8", family: 4 }]);
      expect(resolutions).toBe(1);
      resolve();
    }),
  );
  await new Promise<void>((resolve) =>
    lookup("ilias.university.edu", {}, (error) => {
      expect(error?.message).toContain("public Internet");
      resolve();
    }),
  );
  expect(resolutions).toBe(2);
});
test("real network transport rejects literal and special destinations before fetching", async () => {
  for (const url of [
    "https://127.0.0.1/",
    "https://2130706433/",
    "https://[::1]/",
    "https://host.local/",
    "https://host.internal/",
    "http://ilias.uni-freiburg.de/",
    "https://ilias.uni-freiburg.de:444/",
    "https://user:secret@ilias.uni-freiburg.de/",
  ])
    await expect(upstreamTransport.fetch(url)).rejects.toThrow();
});
test("large chunked HTML and oversized connection payloads are rejected", async () => {
  await expect(
    readUpstreamText(new Response("x".repeat(65)), 64),
  ).rejects.toThrow("too large");
  expect(await readUpstreamText(new Response("äöü"), 6)).toBe("äöü");
  await expect(
    readSmallJson(
      new Request("https://app.example/", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(80) }),
      }),
      64,
    ),
  ).rejects.toThrow("too large");
});
test("sign-in limits isolate trusted clients and do not trust spoofed forwarding headers", async () => {
  const previous = process.env.ACHILIAS_TRUST_PROXY;
  try {
    const limiter = createSignInLimiter();
    process.env.ACHILIAS_TRUST_PROXY = "true";
    const request = (ip: string) =>
      new Request("https://app.example/", {
        headers: { "x-forwarded-for": ip },
      });
    await Promise.all(
      Array.from({ length: 12 }, () =>
        limiter(request("203.0.113.1"), "start"),
      ),
    );
    await expect(limiter(request("203.0.113.1"), "start")).rejects.toThrow(
      "Too many",
    );
    await expect(
      limiter(request("203.0.113.2"), "start"),
    ).resolves.toBeUndefined();
    delete process.env.ACHILIAS_TRUST_PROXY;
    const anonymous = createSignInLimiter();
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        anonymous(request(`203.0.113.${index}`), "start"),
      ),
    );
    await expect(anonymous(request("203.0.113.100"), "start")).rejects.toThrow(
      "Too many",
    );
  } finally {
    if (previous === undefined) delete process.env.ACHILIAS_TRUST_PROXY;
    else process.env.ACHILIAS_TRUST_PROXY = previous;
  }
});
test("parallel verification has a bounded capacity", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const operations = Array.from({ length: 8 }, () =>
    withVerificationLimit(() => pending),
  );
  await expect(withVerificationLimit(async () => {})).rejects.toThrow("busy");
  release();
  await Promise.all(operations);
  await expect(withVerificationLimit(async () => "ready")).resolves.toBe(
    "ready",
  );
});
