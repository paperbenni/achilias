#!/usr/bin/env node
// Bun runs TypeScript directly; Node uses tsx to load the same CLI.
if (process.versions.bun) {
  await import("../scripts/cli.mts");
} else {
  const { tsImport } = await import("tsx/esm/api");
  await tsImport("../scripts/cli.mts", import.meta.url);
}
