import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("session-only workspace pages read metadata without making ILIAS requests", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "achilias-metadata-test-"),
  );
  try {
    const proc = Bun.spawn(
      [process.execPath, "tests/helpers/workspace-metadata.ts"],
      {
        cwd: process.cwd(),
        env: { ...process.env, ACHILIAS_DATA_DIR: directory },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, status] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("verified");
  } finally {
    await rm(directory, { recursive: true });
  }
});
