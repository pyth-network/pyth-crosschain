import process from "node:process";

export const printLine = (message = ""): void => {
  process.stdout.write(`${message}\n`);
};

export const printError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};
