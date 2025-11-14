import { defineJestConfigForNextJs } from "@pythnetwork/jest-config/define-next-config";
("@pythnetwork/jest-config");

export default defineJestConfigForNextJs({
  testEnvironment: "jsdom",
  setupFiles: ["./jest.setup.js"],
});
