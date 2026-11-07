/** Browser-visible app origin, normalized without a trailing slash. */
export function configuredOrigin() {
  const value = process.env.ACHILIAS_ORIGIN?.trim();
  return value ? value.replace(/\/+$/, "") : undefined;
}

export function isHttpsOrigin() {
  return configuredOrigin()?.toLowerCase().startsWith("https://") ?? false;
}
