/** Avatar accessibility labels are not necessarily account display names. */
export function profileName(value: unknown) {
  if (typeof value !== "string") return "";
  const name = value.replace(/\s+/g, " ").trim();
  if (
    /^(?:avatar|profilbild|benutzerbild|profile (?:picture|image)|user avatar)$/i.test(
      name,
    )
  )
    return "";
  return name
    .replace(
      /^(?:avatar|profilbild(?: von)?|profile (?:picture|image)(?: of)?)[:\s]+/i,
      "",
    )
    .trim();
}
