"use client";

import { useEffect } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { useLogger } from "../../hooks/use-logger";

export const ReportAccessibility = () => {
  const logger = useLogger();

  useEffect(() => {
    import("@axe-core/react")
      .then((axe) => axe.default(React, ReactDOM, 1000))
      .catch((error: unknown) => {
        logger.error("Error setting up axe for accessibility testing", error);
      });
  }, [logger]);

  // eslint-disable-next-line unicorn/no-null
  return null;
};
