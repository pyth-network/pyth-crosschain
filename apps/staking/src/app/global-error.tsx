"use client";

import type { ComponentProps } from "react";

import { Error } from "../components/Error";

const GlobalError = (props: ComponentProps<typeof Error>) => (
  <html lang="en" dir="ltr">
    <body>
      <Error {...props} />
    </body>
  </html>
);
export default GlobalError;
