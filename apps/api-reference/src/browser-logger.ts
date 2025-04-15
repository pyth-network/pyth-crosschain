import type { Logger } from "pino";
import pino from "pino";

import { IS_PRODUCTION_BUILD } from "./isomorphic-config";

let LOGGER: Logger | undefined;

export const getLogger = (): Logger => {
  LOGGER ??= pino({ browser: { disabled: IS_PRODUCTION_BUILD } });
  return LOGGER;
};
