"use client";

import type { Logger } from "pino";
import { createContext } from "react";

export const LoggerContext = createContext<undefined | Logger<string>>(
  undefined,
);
