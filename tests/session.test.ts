import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("session files are encrypted, private, tamper-resistant, and removed at expiry", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "achilias-session-test-"));
  try {
    const script = `
      import { saveSession, readSession } from './src/lib/ilias/session';
      import { readFile, stat, writeFile } from 'node:fs/promises';
      const id = '12345678-1234-1234-1234-123456789012';
      const file = process.env.ACHILIAS_DATA_DIR + '/' + id + '.enc';
      await saveSession({ id, instance: 'https://ilias.uni-freiburg.de/', createdAt: Date.now(), status: 'connected', userName: 'private-test-name' });
      if ((await readSession(id))?.userName !== 'private-test-name') throw new Error('Round trip failed');
      if (((await stat(file)).mode & 0o777) !== 0o600) throw new Error('File permissions are too broad');
      const raw = await readFile(file);
      if (raw.includes(Buffer.from('private-test-name'))) throw new Error('Plaintext session leaked');
      raw[raw.length - 1] ^= 1; await writeFile(file, raw);
      if (await readSession(id)) throw new Error('Tampered data was accepted');
      await saveSession({ id, instance: 'https://ilias.uni-freiburg.de/', createdAt: Date.now() - 13 * 3600000, status: 'connected' });
      if (await readSession(id)) throw new Error('Expired session was accepted');
      if (await readSession('../../etc/passwd')) throw new Error('Path escape accepted');
      console.log('verified');
    `;
    const proc = Bun.spawn([process.execPath, "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, ACHILIAS_DATA_DIR: dir },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, errors, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(errors).toBe("");
    expect(code).toBe(0);
    expect(output.trim()).toBe("verified");
    expect(await readdir(dir)).toEqual(["session.key"]);
    expect((await readFile(path.join(dir, "session.key"))).length).toBe(32);
  } finally {
    await rm(dir, { recursive: true });
  }
});
