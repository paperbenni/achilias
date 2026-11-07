import { expect, test } from "bun:test";

async function run(runtime: string, args: string[]) {
  const proc = Bun.spawn([runtime, "bin/achilias.mjs", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exit };
}

async function connectHelp(runtime: string) {
  const result = await run(runtime, ["connect", "--help"]);
  expect(result.exit).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("npx achilias connect");
  expect(result.stdout).toContain("bunx achilias connect");
}

test("the packaged CLI accepts the connect subcommand under Bun", async () => {
  await connectHelp(process.execPath);
});

const node = Bun.which("node");
test.skipIf(!node)(
  "the packaged CLI accepts the connect subcommand under Node",
  async () => {
    await connectHelp(node!);
  },
);

test("the packaged CLI starts a local instance by default", async () => {
  const result = await run(process.execPath, ["--help"]);
  expect(result.exit).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Usage: achilias [options] [command]");
  expect(result.stdout).toContain("start [options]");
  expect(result.stdout).toContain("Run without a command to start");
});

test("the start command documents its local options", async () => {
  const result = await run(process.execPath, ["start", "--help"]);
  expect(result.exit).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("--data-dir");
  expect(result.stdout).toContain("--no-open");
});

test.skipIf(!node)("the start command loads under Node", async () => {
  const result = await run(node!, ["start", "--help"]);
  expect(result.exit).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("--data-dir");
});
