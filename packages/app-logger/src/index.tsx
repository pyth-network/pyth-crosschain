import { useContext } from "react";

import { LoggerContext } from "./context.js";

export const useLogger = () => {
  const logger = useContext(LoggerContext);
  if (logger) {
    return logger;
  } else {
    throw new NotInitializedError();
  }
};

class NotInitializedError extends Error {
  override message =
    "This component must be contained within a `LoggerProvider`!";
}
