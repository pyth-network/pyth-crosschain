import { defineJestConfig } from "@pythnetwork/jest-config/define-config";

export default defineJestConfig({
  moduleNameMapper: {
    "^uuid$": "uuid",
  },
});
