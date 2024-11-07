"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { useEffect } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";

const AXE_TIMEOUT = 1000;

export const ReportAccessibility = () => {
  useReportAccessibility();

  // eslint-disable-next-line unicorn/no-null
  return null;
};

const useReportAccessibility = () => {
  const logger = useLogger();

  useEffect(() => {
    import("@axe-core/react")
      .then((axe) => axe.default(React, ReactDOM, AXE_TIMEOUT))
      .catch((error: unknown) => {
        logger.error("Error setting up axe for accessibility testing", error);
      });
  }, [logger]);
};
