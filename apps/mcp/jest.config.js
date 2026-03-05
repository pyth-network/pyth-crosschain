import { defineJestConfig } from "@pythnetwork/jest-config/define-config";

export default defineJestConfig({
  // msw@2 depends on ESM-only packages (until-async) that cannot
  // be require()'d. Enable ESM for .ts files so Jest uses
  // import() throughout the dependency chain.
  extensionsToTreatAsEsm: [".ts"],
  transformIgnorePatterns: [
    "/node_modules/.pnpm/(?!(until-async|msw|@bundled-es-modules)@)",
  ],
});
