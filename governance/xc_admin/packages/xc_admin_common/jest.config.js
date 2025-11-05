import { defineJestConfig } from "@pythnetwork/jest-config";

export default defineJestConfig({
  moduleNameMapper: {
    "^uuid$": "uuid",
  },
});
