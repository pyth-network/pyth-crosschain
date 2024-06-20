import clsx from "clsx";
import type { HTMLAttributes } from "react";

export const Paragraph = ({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <p className={clsx("mb-6 last:mb-0", className)} {...props} />
);
