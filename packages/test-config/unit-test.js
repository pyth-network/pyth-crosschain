#!/usr/bin/env node
/* eslint-disable n/no-unsupported-features/node-builtins */
import { execSync } from "node:child_process";
import path from "node:path";

const binDir = execSync("pnpm bin", {
  cwd: import.meta.dirname,
  stdio: "pipe",
})
  .toString("utf8")
  .trim();
const viteBinPath = path.join(binDir, "vitest");

execSync(`${viteBinPath} run ${process.argv.slice(2).join(" ")}`.trim(), {
  stdio: "inherit",
});
