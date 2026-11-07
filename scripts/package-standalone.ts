import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const standalone = path.join(root, "standalone");
const built = path.join(root, ".next", "standalone");

if (!existsSync(path.join(built, "server.js")))
  throw new Error(
    "No production standalone build found. Run `bun run build:standalone` instead.",
  );

await rm(standalone, { recursive: true, force: true });
await mkdir(standalone, { recursive: true });
await cp(built, standalone, {
  recursive: true,
});
await cp(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);
try {
  await cp(path.join(root, "public"), path.join(standalone, "public"), {
    recursive: true,
  });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
// The app does not use next/image, so the platform-specific sharp binaries
// are not needed. Dropping them keeps the package portable and smaller.
await rm(path.join(standalone, "node_modules", "sharp"), {
  recursive: true,
  force: true,
});
await rm(path.join(standalone, "node_modules", "@img"), {
  recursive: true,
  force: true,
});
console.log(`Prepared the local server in ${standalone}`);
