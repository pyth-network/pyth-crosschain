#!/usr/bin/env node
import { execSync } from "node:child_process";

const __dirname = import.meta.dirname;

const args = process.argv.slice(2);

execSync(`pnpm vitest run --dir ${process.cwd()} ${args.join(" ")}`.trim(), {
  cwd: __dirname,
  stdio: "inherit",
});
