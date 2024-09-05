import { base } from "@cprussin/jest-config";

/**
 * @type {import("@jest/types").Config.InitialOptions}
 */
export default base({
  global: {
    config: {
      testTimeout: 30_000,
    },
  },
});
