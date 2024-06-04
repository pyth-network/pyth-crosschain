import clsx from "clsx";
import type { ElementType, ComponentProps } from "react";

type MaxWidthProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
};

export const MaxWidth = <T extends ElementType = "div">({
  as,
  className,
  ...props
}: MaxWidthProps<T>) => {
  const Component = as ?? "div";

  return (
    <Component
      className={clsx("mx-auto max-w-7xl px-8", className)}
      {...props}
    />
  );
};
