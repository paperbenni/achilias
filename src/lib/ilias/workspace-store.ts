import { DatabaseSync } from "node:sqlite";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { chmod, stat } from "node:fs/promises";
import { dataDirectory, getStorageKey } from "./private-storage";
import type { IliasPage } from "./types";

export const discoveryTtl = 10 * 60_000;
export type StoredListing = { url: string; page: IliasPage; fetchedAt: number };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** One encrypted, disposable cache of parsed listings. Search is a projection
 * of these same responses, not a second independently maintained data store. */
export class WorkspaceStore {
  private db: DatabaseSync;
  constructor(file: string, private key: Buffer) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      PRAGMA secure_delete=ON; PRAGMA journal_size_limit=16777216;
      CREATE TABLE IF NOT EXISTS workspace_pages (
        account TEXT NOT NULL, cache_key TEXT NOT NULL, fetched_at INTEGER NOT NULL,
        payload BLOB NOT NULL, PRIMARY KEY(account, cache_key)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS workspace_expiry ON workspace_pages(fetched_at);`);
  }
  private decode(row: { payload: Uint8Array } | undefined): StoredListing | undefined {
    if (!row) return;
    try {
      const raw = Buffer.from(row.payload);
      const decipher = createDecipheriv("aes-256-gcm", this.key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
    } catch { return; } // A corrupt cache entry is a miss; upstream remains authoritative.
  }
  read(sessionId: string, url: string, maxAge: number) {
    return this.decode(this.db.prepare(
      "SELECT payload FROM workspace_pages WHERE account=? AND cache_key=? AND fetched_at>?",
    ).get(hash(sessionId), hash(url), Date.now() - maxAge) as { payload: Uint8Array } | undefined);
  }
  listings(sessionId: string): StoredListing[] {
    const rows = this.db.prepare(
      "SELECT payload FROM workspace_pages WHERE account=? AND fetched_at>? ORDER BY fetched_at DESC, rowid DESC LIMIT 100",
    ).all(hash(sessionId), Date.now() - discoveryTtl) as { payload: Uint8Array }[];
    return rows.flatMap((row) => { const value = this.decode(row); return value ? [value] : []; });
  }
  write(sessionId: string, value: StoredListing) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    // Oversized listings are still usable for navigation, but not retained.
    if (data.length > 1024 * 1024) return;
    this.db.prepare("INSERT OR REPLACE INTO workspace_pages VALUES(?, ?, ?, ?)")
      .run(hash(sessionId), hash(value.url), value.fetchedAt, Buffer.concat([iv, cipher.getAuthTag(), data]));
    this.db.prepare("DELETE FROM workspace_pages WHERE fetched_at<=?").run(Date.now() - discoveryTtl);
    this.db.prepare(`DELETE FROM workspace_pages WHERE account=? AND rowid NOT IN
      (SELECT rowid FROM workspace_pages WHERE account=? ORDER BY fetched_at DESC, rowid DESC LIMIT 100)`)
      .run(hash(sessionId), hash(sessionId));
    this.db.exec(`DELETE FROM workspace_pages WHERE rowid NOT IN
      (SELECT rowid FROM workspace_pages ORDER BY fetched_at DESC, rowid DESC LIMIT 2000);
      DELETE FROM workspace_pages WHERE rowid IN (
        SELECT rowid FROM (
          SELECT rowid, SUM(length(payload)) OVER (ORDER BY fetched_at DESC, rowid DESC) AS bytes
          FROM workspace_pages
        ) WHERE bytes > 67108864
      );`);
  }
  clear(sessionId?: string) {
    if (sessionId === undefined) this.db.exec("DELETE FROM workspace_pages");
    else this.db.prepare("DELETE FROM workspace_pages WHERE account=?").run(hash(sessionId));
  }
  close() { this.db.close(); }
}
let store: Promise<WorkspaceStore> | undefined;
export function workspaceStore() {
  return store ||= (async () => {
    if (process.env.NODE_ENV === "test") return new WorkspaceStore(":memory:", randomBytes(32));
    const key = await getStorageKey();
    const file = path.join(dataDirectory, "workspace-cache.sqlite");
    const cache = new WorkspaceStore(file, key);
    await chmod(file, 0o600);
    return cache;
  })().catch((error) => { store = undefined; throw error; });
}

export async function existingWorkspaceStore() {
  if (store || process.env.NODE_ENV === "test") return workspaceStore();
  try { await stat(path.join(dataDirectory, "workspace-cache.sqlite")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  return workspaceStore();
}
