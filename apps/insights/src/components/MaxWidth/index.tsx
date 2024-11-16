import clsx from "clsx";
import type { ComponentProps } from "react";

export const MaxWidth = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={clsx("mx-auto box-content max-w-screen-2xl px-6", className)}
    {...props}
  />
);
