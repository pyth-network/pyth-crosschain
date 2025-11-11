import type { Argv } from "yargs";
import { createCommand } from "../create-command.js";

export function setupHelloWorldCommand(yargs: Argv) {
  return createCommand(
    yargs,
    "hello-world",
    "prints hello world and your name, if provided",
    (y) =>
      y.option("name", {
        alias: "n",
        description: "your name",
        type: "string",
      }),
    async ({ name }) => {
      console.info("hello, world!", name || "");
    },
  );
}
