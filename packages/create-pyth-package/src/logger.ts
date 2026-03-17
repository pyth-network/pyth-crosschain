/* eslint-disable no-console */
// eslint-disable-next-line unicorn/import-style
import type { ColorName } from "chalk";

type LogLevel = "error" | "info" | "warn";

export const Logger = {
  /**
   * Prints a message to the console in whatever color your heart desires ❤️
   */
  colorful(_color: ColorName, _level: LogLevel, ..._msg: unknown[]) {
    // Placeholder - will be implemented in the generated package
  },
  /**
   * Logs an error message
   */
  error(..._msg: unknown[]) {
    // Placeholder - will be implemented in the generated package
  },
  /**
   * Logs an info message
   */
  info(..._msg: unknown[]) {
    // Placeholder - will be implemented in the generated package
  },
  /**
   * Logs a warning message
   */
  warn(..._msg: unknown[]) {
    // Placeholder - will be implemented in the generated package
  },
};
