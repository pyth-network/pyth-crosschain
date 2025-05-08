"use client";

import { ErrorPage } from "@pythnetwork/component-library/ErrorPage";
import { LoggerProvider } from "@pythnetwork/component-library/useLogger";
import type { ComponentProps } from "react";

const GlobalError = (props: ComponentProps<typeof ErrorPage>) => (
  <LoggerProvider>
    <html lang="en" dir="ltr">
      <body>
        <ErrorPage {...props} />
      </body>
    </html>
  </LoggerProvider>
);
export default GlobalError;
