"use client";

import { pino } from "pino";
import { type ComponentProps, useMemo } from "react";

import { LoggerContext } from "./context.js";

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
  return <LoggerContext.Provider value={logger} {...props} />;
};
