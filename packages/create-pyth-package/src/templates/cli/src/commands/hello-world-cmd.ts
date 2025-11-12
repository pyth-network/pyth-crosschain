import type { Argv } from "yargs";

export function setupHelloWorldCommand(yargs: Argv) {
  return yargs.command(
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
