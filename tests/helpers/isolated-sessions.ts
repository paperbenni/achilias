import { expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Isolate environment-bound session paths and module mocks from the test runner. */
export async function runWithIsolatedSessions(
  script: string,
  inspect?: (directory: string) => Promise<void>,
) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "achilias-session-test-"),
  );
  try {
    const child = Bun.spawn([process.execPath, script], {
      cwd: process.cwd(),
      env: { ...process.env, ACHILIAS_DATA_DIR: directory },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, errors, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(errors).toBe("");
    expect(code).toBe(0);
    expect(output.trim()).toBe("verified");
    await inspect?.(directory);
  } finally {
    await rm(directory, { recursive: true });
  }
}
