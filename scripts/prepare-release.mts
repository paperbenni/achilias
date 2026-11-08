import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import { testPackage } from "./test-package.mts";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = path.join(root, "release");
const staging = await mkdtemp(path.join(tmpdir(), "achilias-pack-"));

try {
  // Only verified archives belong in release/, including after a failed retry.
  await rm(destination, { recursive: true, force: true });
  await execa("bun", ["run", "build:standalone"], {
    cwd: root,
    stdio: "inherit",
  });
  // Disable lifecycle scripts: this is also called by prepublishOnly.
  const packed = await execa(
    "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", staging],
    { cwd: root },
  );
  const [{ filename }] = JSON.parse(packed.stdout) as { filename: string }[];
  const archive = path.join(staging, filename);
  await testPackage(archive);
  await mkdir(destination, { recursive: true });
  await cp(archive, path.join(destination, filename));
  console.log(`Verified release: release/${filename}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
