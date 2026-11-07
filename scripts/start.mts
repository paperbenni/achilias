import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import envPaths from "env-paths";
import { execa } from "execa";
import getPort, { portNumbers } from "get-port";
import open from "open";
import waitOn from "wait-on";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

export type StartOptions = {
  port?: number;
  hostname: string;
  dataDir?: string;
  open: boolean;
};

export async function runStart(options: StartOptions) {
  const hostname = options.hostname;
  const port = options.port
    ? await getPort({
        port: portNumbers(options.port, options.port),
        host: hostname,
      })
    : await getPort({ port: portNumbers(3000, 3100), host: hostname });
  if (options.port && port !== options.port)
    throw new Error(`Port ${options.port} is already in use.`);
  const dataDir = path.resolve(
    options.dataDir ||
      process.env.ACHILIAS_DATA_DIR ||
      envPaths("achilias", { suffix: "" }).data,
  );
  const standalone = path.join(packageRoot, "standalone");
  const server = path.join(standalone, "server.js");
  if (!existsSync(server))
    throw new Error(
      "This package does not include the local server build. From a checkout, run `bun run build:standalone` first.",
    );
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const browserHost =
    hostname === "0.0.0.0" || hostname === "::" ? "127.0.0.1" : hostname;
  const urlHost = browserHost.includes(":") ? `[${browserHost}]` : browserHost;
  const url = `http://${urlHost}:${port}`;
  console.log(`Starting the production Achilias server at ${url}`);
  console.log(`Data: ${dataDir}`);
  const child = execa(process.execPath, [server], {
    cwd: standalone,
    env: {
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      HOSTNAME: hostname,
      ACHILIAS_ORIGIN: url,
      ACHILIAS_DATA_DIR: dataDir,
    },
    stdio: "inherit",
    reject: false,
    cleanup: true,
  });
  const stop = (signal: NodeJS.Signals) => {
    child.kill(signal);
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
  const outcome = await Promise.race([
    waitOn({
      resources: [`http-get://${urlHost}:${port}/`],
      timeout: 30_000,
      interval: 250,
    }).then(() => ({ ready: true as const })),
    child.then((result) => ({ ready: false as const, result })),
  ]).catch(async (error) => {
    stop("SIGTERM");
    await child.catch(() => {});
    throw error;
  });
  if (!outcome.ready)
    throw new Error(
      `The local server stopped with exit code ${outcome.result.exitCode ?? outcome.result.signal ?? "unknown"}.`,
    );
  console.log("Achilias is ready. Press Ctrl+C to stop.");
  if (options.open) await open(url).catch(() => {});
  const result = await child;
  process.exitCode = result.exitCode ?? (result.signal ? 0 : 1);
}
