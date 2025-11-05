import type { Config } from "jest";

export function defineJestConfig(config?: Config) {
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
