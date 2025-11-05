const { defineJestConfig } = require("@pythnetwork/jest-config");

module.exports = defineJestConfig({
  maxWorkers: 1, // Prevents serialization issues with BigInt during error reporting
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
});
