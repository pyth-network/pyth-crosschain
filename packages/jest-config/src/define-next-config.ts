import { nextjs } from "@cprussin/jest-config/next";
import type { Config } from "jest";
import { merge } from "ts-deepmerge";
import { defineJestConfig } from "./define-config.js";
import { defineReactConfig } from "./define-react-config.js";

export function defineJestConfigForNextJs(config?: Config): Config {
  return defineJestConfig(
    merge(nextjs, defineReactConfig(), config ?? {}) as Config,
  );
}
