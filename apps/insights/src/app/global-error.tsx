"use client";

import { ErrorPage } from "@pythnetwork/component-library/ErrorPage";
import { LoggerProvider } from "@pythnetwork/component-library/useLogger";
import type { ComponentProps } from "react";

const GlobalError = (props: ComponentProps<typeof ErrorPage>) => (
  <LoggerProvider>
    <html dir="ltr" lang="en">
      <body>
        <ErrorPage {...props} />
      </body>
    </html>
  </LoggerProvider>
);
export default GlobalError;
