import type { ArgumentsCamelCase, Argv } from "yargs";

/**
 * helper for creating a command and registering it
 * to your command line interface with proper typings
 */
export function createCommand<T extends object>(
  yargs: Argv,
  commandName: string,
  description: string,
  builder: (y: Argv) => Argv<T>,
  executor: (args: ArgumentsCamelCase<T>) => Promise<void>,
) {
  return yargs.command(commandName, description, builder, executor);
}
