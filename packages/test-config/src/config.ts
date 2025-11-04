import reactPlugin from "@vitejs/plugin-react";
import type { UserConfig } from "vite";
import { defineConfig } from "vitest/config";
export * from "vitest";

export function defineTestConfig(config?: UserConfig) {
  return defineConfig({
    ...config,
    plugins: [...(config?.plugins ?? []), reactPlugin()],
    test: {
      ...config?.test,
      environment: config?.test?.environment ?? "happy-dom",
    },
  });
}
