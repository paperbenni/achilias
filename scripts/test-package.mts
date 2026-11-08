import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function testPackage(archive: string) {
  const node = Bun.which("node");
  assert(node, "Node is required to verify the release package.");
  const sandbox = await mkdtemp(path.join(tmpdir(), "achilias-install-"));
  try {
    await execa(
      "npm",
      [
        "install",
        path.resolve(archive),
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
      ],
      { cwd: sandbox, stdio: "inherit" },
    );
    const installed = path.join(sandbox, "node_modules", "achilias");
    const cli = path.join(sandbox, "node_modules", ".bin", "achilias");
    const manifest = JSON.parse(
      await readFile(path.join(installed, "package.json"), "utf8"),
    ) as { version: string };
    const bundle = await readFile(path.join(installed, "bin", "cli.mjs"), "utf8");
    assert(!bundle.includes(root), "The CLI embeds a build-machine path.");

    for (const runtime of [node, process.execPath]) {
      const label = runtime === node ? "Node" : "Bun";
      // Ignore checkout configuration; every run owns disposable user data.
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) =>
            !key.startsWith("ACHILIAS_") &&
            key !== "NODE_PATH" &&
            key !== "NODE_OPTIONS",
        ),
      );
      Object.assign(env, {
        XDG_DATA_HOME: path.join(sandbox, label, "data"),
        APPDATA: path.join(sandbox, label, "data"),
        LOCALAPPDATA: path.join(sandbox, label, "data"),
      });
      // macOS does not use XDG paths. Keep its smoke-test data disposable too.
      if (process.platform === "darwin")
        env.ACHILIAS_DATA_DIR = path.join(sandbox, label, "data");
      const options = { cwd: sandbox, env, extendEnv: false, timeout: 15_000 };
      const runtimeVersion = await execa(runtime, ["--version"], options);
      const version = await execa(runtime, [cli, "--version"], options);
      assert.equal(version.stdout, manifest.version);
      for (const args of [
        ["--help"],
        ["start", "--help"],
        ["connect", "--help"],
      ]) {
        const help = await execa(runtime, [cli, ...args], options);
        assert.match(help.stdout, /Usage: achilias/);
        assert.equal(help.stderr, "");
      }

      // No subcommand, port, or data-dir override: exercise the advertised defaults.
      const child = execa(runtime, [cli, "--no-open"], {
        cwd: sandbox,
        env,
        extendEnv: false,
        reject: false,
        forceKillAfterDelay: 5_000,
      });
      let output = "";
      let serverUrl: URL | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const ready = new Promise<string>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Startup timed out.")), 45_000);
        child.stderr?.on("data", (chunk) => {
          output += chunk.toString();
        });
        child.stdout?.on("data", (chunk) => {
          output += chunk.toString();
          if (output.includes("Achilias is ready.")) {
            const url = output.match(
              /Starting the production Achilias server at (http:\/\/\S+)/,
            )?.[1];
            if (url) resolve(url);
          }
        });
      });
      try {
        const url = await Promise.race([
          ready,
          child.then(() => {
            throw new Error("CLI exited before readiness.");
          }),
        ]);
        serverUrl = new URL(url);
        const dataDir = output.match(/^Data: (.+)$/m)?.[1];
        assert(dataDir?.startsWith(sandbox + path.sep), "Data escaped the sandbox.");
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /Achilias/i);
        const assets = [
          ...html.matchAll(/(?:src|href)="(\/_next\/[^"]+)"/g),
        ].map((match) => match[1].replaceAll("&amp;", "&"));
        assert(
          assets.some((asset) => asset.includes(".js")),
          "No client JS in the page.",
        );
        assert(
          assets.some((asset) => asset.includes(".css")),
          "No stylesheet in the page.",
        );
        for (const asset of new Set(assets)) {
          const resource = await fetch(new URL(asset, url), {
            signal: AbortSignal.timeout(10_000),
          });
          assert.equal(resource.status, 200, `Missing asset: ${asset}`);
          await resource.arrayBuffer();
        }
        const session = await fetch(new URL("/api/session", url), {
          signal: AbortSignal.timeout(10_000),
        });
        assert.equal(session.status, 200);
        assert.deepEqual(await session.json(), { status: "disconnected" });
      } catch (error) {
        throw new Error(`${label} package smoke test failed.\n${output}`, {
          cause: error,
        });
      } finally {
        clearTimeout(timer);
        child.kill("SIGTERM");
        const result = await child;
        assert(
          !result.isForcefullyTerminated,
          `${label}: CLI did not stop after SIGTERM.\n${output}`,
        );
        if (serverUrl) {
          const probe = createConnection({
            host: serverUrl.hostname,
            port: Number(serverUrl.port),
          });
          try {
            await assert.rejects(
              once(probe, "connect", { signal: AbortSignal.timeout(2_000) }),
              { code: "ECONNREFUSED" },
              `${label}: server still listening after CLI shutdown.`,
            );
          } finally {
            probe.destroy();
          }
        }
      }
      console.log(
        `${label} ${runtimeVersion.stdout}: installed CLI, server, assets, session API, and shutdown passed.`,
      );
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const archive = process.argv[2];
  assert(archive, "Usage: bun run test:package <package.tgz>");
  await testPackage(archive);
}
