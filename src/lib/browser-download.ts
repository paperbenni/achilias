import { fileName } from "./file-disposition";
/** Download through the app while keeping expired-session and permission errors in the UI. */
export async function downloadFile(href: string, fallbackName: string) {
  const response = await fetch(href, { cache: "no-store" });
  if (!response.ok) {
    let message =
      "Download failed. Check the original ILIAS page or reconnect your account.";
    try {
      const result = await response.json();
      if (typeof result.error === "string") message = result.error;
    } catch {
      /* A proxy may return an HTML error instead of JSON. */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const filename = fileName(
    response.headers.get("content-disposition"),
    fallbackName,
  );
  const anchor = document.createElement("a");
  anchor.hidden = true;
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}
