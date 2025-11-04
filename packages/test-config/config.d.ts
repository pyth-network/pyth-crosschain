import { UserConfig } from "vite";
import { defineConfig } from "vitest/config";
export * from "vitest";

export function defineTestConfig(
  config?: UserConfig,
): ReturnType<typeof defineConfig>;
