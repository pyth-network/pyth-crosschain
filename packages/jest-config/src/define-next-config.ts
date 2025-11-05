import type { Config } from "jest";
import { nextjs } from "@cprussin/jest-config/next";
import { defineJestConfig } from "./define-config.js";
import { merge } from "ts-deepmerge";

export function defineJestConfigForNextJs(config?: Config): Config {
  return defineJestConfig(merge(nextjs, config ?? {}) as Config);
}
