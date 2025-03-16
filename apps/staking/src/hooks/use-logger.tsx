"use client";

import type { Logger } from "pino";
import pino from "pino";
import type { ComponentProps } from "react";
import { createContext, useContext, useMemo } from "react";

const LoggerContext = createContext<undefined | Logger<string>>(undefined);

type LoggerContextProps = Omit<
  ComponentProps<typeof LoggerContext.Provider>,
  "config" | "value"
> & {
  config?: Parameters<typeof pino>[0] | undefined;
};

export const LoggerProvider = ({ config, ...props }: LoggerContextProps) => {
  const logger = useMemo(
    () =>
      pino({
        ...config,
        browser: { ...config?.browser },
      }),
    [config],
  );
  return <LoggerContext.Provider value={logger} {...props} />;
};

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
