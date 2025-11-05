import { defineJestConfig } from "@pythnetwork/jest-config/define-config";

export default defineJestConfig({
  global: {
    config: {
      testTimeout: 1_000_000,
    },
  },
});
