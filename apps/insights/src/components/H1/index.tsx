import clsx from "clsx";
import type { ComponentProps } from "react";

export const H1 = ({ className, children, ...props }: ComponentProps<"h1">) => (
  <h1 className={clsx(className, "text-2xl font-medium")} {...props}>
    {children}
  </h1>
);
