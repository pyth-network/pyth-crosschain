import chalk from "chalk";

/**
 * @typedef {import('chalk').ColorName} ColorName
 */

/**
 * @typedef {'error' | 'info' | 'warn'} LogLevel
 */

export const Logger = {
  /**
   * Prints a message to the console in whatever color your heart desires ❤️
   *
   * @param {ColorName} color
   * @param {LogLevel} level
   * @param  {...any} msg
   */
  colorful(color, level, ...msg) {
    console[level](chalk[color](...msg));
  },
  /**
   * Logs an error message
   *
   * @param  {...any} msg
   */
  error(...msg) {
    console.error(chalk.red(...msg));
  },
  /**
   * Logs an info message
   *
   * @param  {...any} msg
   */
  info(...msg) {
    console.info(chalk.blue(...msg));
  },
  /**
   * Logs a warning message
   *
   * @param  {...any} msg
   */
  warn(...msg) {
    console.warn(chalk.yellow(...msg));
  },
};
