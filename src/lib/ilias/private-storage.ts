import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
export const dataDirectory = path.resolve(
  /* turbopackIgnore: true */ process.env.ACHILIAS_DATA_DIR || ".local",
);
let keyPromise: Promise<Buffer> | undefined;
export async function getStorageKey() {
  return (keyPromise ||= (async () => {
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    const file = path.join(dataDirectory, "session.key");
    try {
      return await readFile(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const key = randomBytes(32);
    try {
      await writeFile(file, key, { flag: "wx", mode: 0o600 });
      return key;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return readFile(file);
      throw e;
    }
  })());
}
