export const FREIBURG = "https://ilias.uni-freiburg.de/";
export function normalizeInstance(input: string) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error(
      "Use the HTTPS address of your ILIAS instance, without a port or credentials.",
    );
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(
    /(?:login|index|ilias|goto|shib_login)\.php.*$/i,
    "",
  );
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}
export function allowedInstances() {
  return [
    FREIBURG,
    ...(process.env.ILIAS_INSTANCES || "").split(",").filter(Boolean),
  ].map(normalizeInstance);
}
export function assertInstance(input: string) {
  const normalized = normalizeInstance(input);
  if (!allowedInstances().includes(normalized))
    throw new Error(
      "This instance is not configured. Add its HTTPS base URL to ILIAS_INSTANCES on the server.",
    );
  return normalized;
}
export function instanceName(instance: string) {
  return instance === FREIBURG
    ? "University of Freiburg"
    : new URL(instance).hostname;
}
export function upstreamUrl(instance: string, path: string) {
  const url = new URL(path, instance);
  const base = new URL(instance);
  if (
    url.origin !== base.origin ||
    !url.pathname.startsWith(base.pathname) ||
    url.username ||
    url.password
  ) {
    throw new Error("The requested address is outside your ILIAS instance.");
  }
  return url;
}
export function objectUrl(
  instance: string,
  type: string,
  id: string,
  download = false,
) {
  if (!/^[a-z]{2,8}$/.test(type) || !/^[1-9]\d{0,11}$/.test(id))
    throw new Error("Invalid ILIAS object.");
  const url = upstreamUrl(instance, "goto.php");
  url.searchParams.set("target", `${type}_${id}`);
  if (download) url.searchParams.set("cmd", "download");
  return url.href;
}
