"use client";

import pino, { type Logger } from "pino";
import { type ComponentProps, createContext, useContext, useMemo } from "react";

import { IS_PRODUCTION_BUILD } from "../config/isomorphic";

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
        browser: { ...config?.browser, disabled: IS_PRODUCTION_BUILD },
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
