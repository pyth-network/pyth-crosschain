import type { Config } from "jest";
import { nextjs } from "@cprussin/jest-config/next";
import { merge } from "ts-deepmerge";

export function defineJestConfig(config?: Config): Config {
  return {
    ...config,
    resolver: config?.resolver ?? "jest-ts-webcompat-resolver",
    transform: {
      "^.+\\.(t|j)sx?$": ["@swc/jest"],
      ...config?.transform,
    },
    testEnvironment: config?.testEnvironment ?? "node",
  } as unknown as Config;
}

export function defineJestConfigForNextJs(config?: Config): Config {
  return defineJestConfig(merge(nextjs, config ?? {}) as Config);
}
