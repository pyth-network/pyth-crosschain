import clsx from "clsx";
import type { ComponentProps, ElementType } from "react";

type InlineLinkProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
};

export const InlineLink = <T extends ElementType>({
  as,
  className,
  ...props
}: InlineLinkProps<T>) => {
  const Component = as ?? "a";
  return (
    <Component
      className={clsx(
        "font-medium text-pythpurple-600 hover:underline dark:text-pythpurple-400",
        className,
      )}
      {...props}
    />
  );
};
