import type { Config } from "jest";

/**
 * creates a very reasonable and fast jest config that
 * will transform your files, without typechecking,
 * and will automatically resolve your imports correctly.
 *
 * for most things, you want to use this configuration
 */
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
