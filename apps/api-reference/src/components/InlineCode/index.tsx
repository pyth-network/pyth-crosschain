import clsx from "clsx";
import type { HTMLAttributes } from "react";

export const InlineCode = ({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <code
    className={clsx(
      "whitespace-nowrap rounded-md border border-neutral-200 bg-neutral-100 px-1 py-0.5 text-[0.9em] dark:border-neutral-700 dark:bg-neutral-800",
      className,
    )}
    {...props}
  />
);
