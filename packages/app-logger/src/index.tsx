import { useContext } from "react";

import { LoggerContext } from "./context.js";

export const useLogger = () => {
  const logger = useContext(LoggerContext);
  if (logger) {
    return logger;
  } else {
    throw new LoggerNotInitializedError();
  }
};

class LoggerNotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a <LoggerProvider>");
    this.name = "LoggerNotInitializedError";
  }
}
