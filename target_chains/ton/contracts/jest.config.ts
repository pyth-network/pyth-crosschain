import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  maxWorkers: 1, // Prevents serialization issues with BigInt during error reporting
};

export default config;
