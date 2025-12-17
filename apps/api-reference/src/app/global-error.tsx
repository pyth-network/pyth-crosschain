"use client";

import type { ComponentProps } from "react";

import { ErrorComponent } from "../components/Error";

const GlobalError = (props: ComponentProps<typeof ErrorComponent>) => (
  <html lang="en" dir="ltr">
    <body>
      <ErrorComponent {...props} />
    </body>
  </html>
);
export default GlobalError;
