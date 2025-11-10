/* eslint-disable no-console */
// eslint-disable-next-line unicorn/import-style
import type { ColorName } from "chalk";
import chalk from "chalk";

type LogLevel = "error" | "info" | "warn";

export const Logger = {
  /**
   * Prints a message to the console in whatever color your heart desires ❤️
   */
  colorful(color: ColorName, level: LogLevel, ...msg: unknown[]) {
    console[level](chalk[color](...msg));
  },
  /**
   * Logs an error message
   */
  error(...msg: unknown[]) {
    console.error(chalk.red(...msg));
  },
  /**
   * Logs an info message
   */
  info(...msg: unknown[]) {
    console.info(chalk.blue(...msg));
  },
  /**
   * Logs a warning message
   */
  warn(...msg: unknown[]) {
    console.warn(chalk.yellow(...msg));
  },
};
