/**
 * Password sign-in defaults to on for local use and off for a public HTTPS
 * origin. Set ACHILIAS_PASSWORD_LOGIN to override either default.
 */
export function passwordLoginEnabled() {
  const configured = process.env.ACHILIAS_PASSWORD_LOGIN?.trim();
  if (configured) return /^(?:1|true|yes|on)$/i.test(configured);
  return !process.env.ACHILIAS_ORIGIN?.trim()
    .toLowerCase()
    .startsWith("https://");
}
