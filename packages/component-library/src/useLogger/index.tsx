"use client";

import type { Logger } from "pino";
import { pino } from "pino";
import type { ComponentProps } from "react";
import { createContext, useMemo, use } from "react";

const LoggerContext = createContext<undefined | Logger<string>>(undefined);

type LoggerProviderProps = Omit<
  ComponentProps<typeof LoggerContext.Provider>,
  "config" | "value"
> & {
  config?: Parameters<typeof pino>[0] | undefined;
};

export const LoggerProvider = ({ config, ...props }: LoggerProviderProps) => {
  const logger = useMemo(
    () =>
      pino({
        ...config,
        browser: { ...config?.browser },
      }),
    [config],
  );
  return <LoggerContext value={logger} {...props} />;
};

export const useLogger = () => {
  const logger = use(LoggerContext);
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
