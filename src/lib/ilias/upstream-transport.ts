import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";

export function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.parse(address);
    // Reject mapped IPv4 too: literal IP hosts are not supported and this avoids
    // IPv6 transition/tunnel routes bypassing the IPv4 classification.
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export function publicHostname(hostname: string) {
  const name = hostname.toLowerCase().replace(/\.$/, "");
  return (
    !isIP(name.replace(/^\[|\]$/g, "")) &&
    name.includes(".") &&
    !/(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion)$/.test(
      name,
    )
  );
}
export function validatePublicAddresses(
  records: { address: string; family: number }[],
) {
  if (
    !records.length ||
    records.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error(
      "The ILIAS hostname must resolve exclusively to public Internet addresses.",
    );
  return records;
}
/** This lookup is used by the actual TLS connection, not a separate preflight.
 * Checked IPs are handed straight to the socket, preventing DNS rebinding. */
export function createPublicLookup(
  resolve = (hostname: string) =>
    lookup(hostname, { all: true, verbatim: true }),
): LookupFunction {
  return (hostname, options, callback) => {
    if (!publicHostname(hostname)) {
      callback(
        new Error("Only public Internet ILIAS hostnames are allowed."),
        "",
        4,
      );
      return;
    }
    void resolve(hostname)
      .then((records) => {
        const safe = validatePublicAddresses(records);
        const family = typeof options === "number" ? options : options.family;
        const chosen = safe.filter((r) => !family || r.family === family);
        if (!chosen.length)
          throw new Error("No public address for the requested family.");
        if (typeof options === "object" && options.all) callback(null, chosen);
        else callback(null, chosen[0].address, chosen[0].family);
      })
      .catch((error: Error) => callback(error, "", 4));
  };
}
export const publicLookup = createPublicLookup();
const agent = new Agent({
  connect: { lookup: publicLookup, timeout: 10_000 },
  connections: 4,
  maxOrigins: 128,
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 10_000,
  headersTimeout: 25_000,
  bodyTimeout: 25_000,
  maxResponseSize: 512 * 1024 * 1024,
});
type UpstreamFetch = (
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
) => Promise<Response>;
async function publicFetch(
  input: Parameters<typeof fetch>[0],
  init: RequestInit = {},
) {
  const url = new URL(
    typeof input === "object" && "url" in input ? input.url : String(input),
  );
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !publicHostname(url.hostname)
  )
    throw new Error(
      "Use a public HTTPS ILIAS hostname without credentials or a custom port.",
    );
  // Never use environment proxy agents or automatic redirects. Each redirect is
  // independently scoped by client.ts and each new socket uses publicLookup.
  return (await undiciFetch(url, {
    ...init,
    redirect: "manual",
    dispatcher: agent,
  } as Parameters<typeof undiciFetch>[1])) as unknown as Response;
}
/** Explicit transport seam for fixture tests; never configured by a request or env var. */
export const upstreamTransport: { fetch: UpstreamFetch } = {
  fetch: publicFetch,
};
