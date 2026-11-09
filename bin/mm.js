#!/usr/bin/env node
// Thin launcher so `npx mm ...` works from anywhere in the repo.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = spawnSync(
  process.execPath,
  ["--import", "tsx", join(root, "engine/src/cli.ts"), ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, MM_ROOT: process.env.MM_ROOT ?? root } },
);
process.exit(res.status ?? 1);
