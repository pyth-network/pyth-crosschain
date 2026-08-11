import { defineJestConfigForNextJs } from "@pythnetwork/jest-config/define-next-config";

export default defineJestConfigForNextJs({
  moduleNameMapper: {
    "\\.module\\.scss$": "<rootDir>/css-module-mock.cjs",
  },
});
