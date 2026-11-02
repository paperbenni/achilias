/**
 * Hostnames a browser on the same machine can reach without a configured
 * ACHILIAS_ORIGIN. Anything else must match the configured origin exactly.
 */
const loopbackHostnames = ["localhost", "127.0.0.1", "[::1]"];

export function isLoopbackHostname(hostname: string) {
  return loopbackHostnames.includes(hostname);
}
