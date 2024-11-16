import clsx from "clsx";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"span">, "children">;

export const Skeleton = ({ className, ...props }: Props) => (
  <span className="animate-pulse rounded-lg bg-stone-200 dark:bg-steel-800">
    <span className={clsx("inline-block", className)} {...props}>
      <span className="sr-only">Loading</span>
    </span>
  </span>
);
