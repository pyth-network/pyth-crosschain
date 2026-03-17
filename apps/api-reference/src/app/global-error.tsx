"use client";

import type { ComponentProps } from "react";

import { Error } from "../components/Error";

const GlobalError = (props: ComponentProps<typeof Error>) => (
  <html dir="ltr" lang="en">
    <body>
      <Error {...props} />
    </body>
  </html>
);
export default GlobalError;
