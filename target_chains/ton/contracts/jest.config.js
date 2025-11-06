const { defineJestConfig } = require("@pythnetwork/jest-config/define-config");

module.exports = defineJestConfig({
  maxWorkers: 1, // Prevents serialization issues with BigInt during error reporting
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testTimeout: 60 * 1000 * 4, // 4 minutes for slow tests
});
