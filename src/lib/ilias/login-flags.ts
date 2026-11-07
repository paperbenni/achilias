/**
 * Password sign-in is on by default. Set ACHILIAS_PASSWORD_LOGIN=false on a
 * shared or public deployment where the server must not receive credentials.
 */
export function passwordLoginEnabled() {
  const configured = process.env.ACHILIAS_PASSWORD_LOGIN?.trim();
  if (configured) return /^(?:1|true|yes|on)$/i.test(configured);
  return true;
}
