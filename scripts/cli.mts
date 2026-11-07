import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { runConnect } from "./connect.mts";
import { runStart } from "./start.mts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

function version() {
  const packageJson = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  ) as { version?: string };
  return packageJson.version || "0.0.0";
}

function parsePort(value: string) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Enter a port between 1 and 65535.");
  return port;
}

const program = new Command()
  .name("achilias")
  .description(
    "A calmer frontend for ILIAS. Run without a command to start a local instance.",
  )
  .version(version())
  .showHelpAfterError()
  .addHelpText(
    "after",
    `
Without a command, starts a local Achilias instance on this computer, opens the browser, and keeps encrypted sessions in your user data directory. Use --no-open to skip the browser.
\`connect\` starts the laptop sign-in helper for an existing Achilias server.
Bun users can replace npx with bunx.`,
  );

program
  .command("start", { isDefault: true })
  .description("Start a local Achilias instance.")
  .option(
    "--port <port>",
    "port to listen on (default: the first free port from 3000)",
    parsePort,
  )
  .option("--hostname <host>", "interface to bind", "127.0.0.1")
  .option("--data-dir <path>", "private data directory")
  .option("--no-open", "do not open the browser")
  .action(async (options) => {
    await runStart({
      port: options.port,
      hostname: options.hostname,
      dataDir: options.dataDir,
      open: options.open,
    });
  });

program
  .command("connect")
  .description(
    "Sign in through the laptop helper for an existing Achilias server.",
  )
  .option("--server <url>", "Achilias server origin")
  .option("--instance <url>", "ILIAS instance")
  .option("--cookies <path>", "cookie export file")
  .option("--proxy <url>", "SOCKS proxy for the sign-in browser")
  .option("--app <url>", "Achilias app origin for local sign-in")
  .addHelpText(
    "after",
    `
Without --server, run from an Achilias checkout with Bun. A local browser opens for university sign-in, or --cookies imports an existing export. The command prints a single-use browser connection link.
With --server, run on your laptop. No checkout is needed; npx/bunx downloads the helper. Paste the temporary code from the server's sign-in form when prompted. The helper signs in locally and transfers only ILIAS cookies over HTTPS or loopback HTTP. Chromium is installed automatically on first use. Use --proxy with an SSH SOCKS tunnel if ILIAS binds sessions to the login IP.
The connection code is read from stdin and is never passed as a command-line argument.
Run with npx achilias connect or bunx achilias connect.`,
  )
  .action(async (options) => {
    await runConnect({
      server: options.server,
      instance: options.instance,
      cookies: options.cookies,
      proxy: options.proxy,
      app: options.app,
    });
  });

async function main() {
  await program.parseAsync(process.argv);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Achilias failed.");
  process.exitCode = 1;
});
