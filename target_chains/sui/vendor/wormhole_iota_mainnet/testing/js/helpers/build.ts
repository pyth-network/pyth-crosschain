import type { ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { execSync } from "node:child_process";
import { fromB64, normalizeSuiObjectId } from "@mysten/sui.js";
import { UTF8 } from "./consts";

export const EXEC_UTF8: ExecSyncOptionsWithStringEncoding = { encoding: UTF8 };

export function buildForBytecode(packagePath: string) {
  const buildOutput: {
    modules: string[];
    dependencies: string[];
  } = JSON.parse(
    execSync(
      `sui move build --dump-bytecode-as-base64 -p ${packagePath} 2> /dev/null`,
      EXEC_UTF8,
    ),
  );
  return {
    dependencies: buildOutput.dependencies.map((d: string) =>
      normalizeSuiObjectId(d),
    ),
    modules: buildOutput.modules.map((m: string) => Array.from(fromB64(m))),
  };
}

export function buildForDigest(packagePath: string) {
  const digest = execSync(
    `sui move build --dump-package-digest -p ${packagePath} 2> /dev/null`,
    EXEC_UTF8,
  ).substring(0, 64);

  return Buffer.from(digest, "hex");
}
