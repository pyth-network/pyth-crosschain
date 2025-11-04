import reactPlugin from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export * from "vitest";

export function defineTestConfig(config) {
  return defineConfig({
    ...config,
    plugins: [...(config?.plugins ?? []), reactPlugin()],
    test: {
      ...config?.test,
      environment: config?.environment ?? "jsdom",
    },
  });
}
