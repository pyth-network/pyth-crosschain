import { defineConfig, TestUserConfig } from "vitest/config";
export * from "vitest";

export function defineTestConfig(
  config?: TestUserConfig,
): ReturnType<typeof defineConfig>;
