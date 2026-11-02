import { parsePairingCode } from "./pairing";
export function remoteServerUrl(value: string) {
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "Use an HTTPS app origin, or loopback HTTP through an SSH tunnel, without credentials, a path, query, or fragment.",
    );
  }
  return url.origin;
}
export async function remoteRequest(
  server: string,
  code: string,
  cookies?: unknown,
) {
  if (!parsePairingCode(code))
    throw new Error("Paste the complete connection code shown by Achilias.");
  let response: Response;
  try {
    response = await fetch(`${remoteServerUrl(server)}/api/connect/remote`, {
      method: cookies === undefined ? "GET" : "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${code}`,
        ...(cookies === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(cookies === undefined ? {} : { body: JSON.stringify(cookies) }),
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new Error(
      "Could not reach the Achilias server. Check its exact address and HTTPS certificate, or your SSH tunnel. Redirects are not followed for session transfers.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server did not return an Achilias connection response.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "The server could not accept the session.",
    );
  return data;
}
