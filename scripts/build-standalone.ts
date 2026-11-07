import { fileURLToPath } from "node:url";
import { execa } from "execa";

const root = fileURLToPath(new URL("..", import.meta.url));

await execa("bun", ["run", "build"], {
  cwd: root,
  env: { ACHILIAS_STANDALONE: "true" },
  stdio: "inherit",
});
await execa("bun", ["run", "package:standalone"], {
  cwd: root,
  stdio: "inherit",
});

await execa(
  "bun",
  [
    "build",
    "scripts/cli.mts",
    "--target=node",
    "--format=cjs",
    "--packages=external",
    "--outfile=bin/cli.cjs",
  ],
  { cwd: root, stdio: "inherit" },
);
