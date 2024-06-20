"use client";

import { useEffect } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { getLogger } from "../../browser-logger";

export const ReportAccessibility = () => {
  useEffect(() => {
    import("@axe-core/react")
      .then((axe) => axe.default(React, ReactDOM, 1000))
      .catch((error: unknown) => {
        getLogger().error(
          "Error setting up axe for accessibility testing",
          error,
        );
      });
  }, []);

  // eslint-disable-next-line unicorn/no-null
  return null;
};
