/** Opt-in credential sign-in, intended only for a single-user local server. */
export function passwordLoginEnabled() {
  return /^(?:1|true)$/i.test(process.env.ACHILIAS_PASSWORD_LOGIN || "");
}
