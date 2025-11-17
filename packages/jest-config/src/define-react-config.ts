import type { Config } from "jest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineJestConfig } from "./define-config.js";

function getThisDirname(): string {
  // Works in ESM
  if (typeof import.meta.url === "string") {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  // Works in CJS
  return __dirname;
}

/**
 * sets up a jest test environment that works
 * for testing react components
 */
export function defineReactConfig(config?: Config): Config {
  const dirname = getThisDirname();
  const allFiles = fs.readdirSync(dirname);

  const setupFiles = allFiles
    .filter(
      (fp) =>
        fp.endsWith("setup-file-react.mjs") ||
        fp.endsWith("setup-file-react.cjs"),
    )
    .map((fp) => path.join(dirname, fp));

  return defineJestConfig({
    ...config,
    setupFiles,
    testEnvironment: "jsdom",
  });
}
