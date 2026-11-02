import { saveSession, readSession } from "../../src/lib/ilias/session";
import { readFile, stat, writeFile } from "node:fs/promises";
const id = "12345678-1234-1234-1234-123456789012";
const file = process.env.ACHILIAS_DATA_DIR + "/" + id + ".enc";
await saveSession({
  id,
  instance: "https://ilias.uni-freiburg.de/",
  createdAt: Date.now(),
  status: "connected",
  userName: "private-test-name",
});
if ((await readSession(id))?.userName !== "private-test-name")
  throw new Error("Round trip failed");
if (((await stat(file)).mode & 0o777) !== 0o600)
  throw new Error("File permissions are too broad");
const raw = await readFile(file);
if (raw.includes(Buffer.from("private-test-name")))
  throw new Error("Plaintext session leaked");
raw[raw.length - 1] ^= 1;
await writeFile(file, raw);
if (await readSession(id)) throw new Error("Tampered data was accepted");
await saveSession({
  id,
  instance: "https://ilias.uni-freiburg.de/",
  createdAt: Date.now() - 13 * 3600000,
  status: "connected",
});
if (await readSession(id)) throw new Error("Expired session was accepted");
if (await readSession("../../etc/passwd"))
  throw new Error("Path escape accepted");
console.log("verified");
