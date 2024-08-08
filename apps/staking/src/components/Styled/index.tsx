import clsx from "clsx";
import type { ComponentProps, ElementType } from "react";

type StyledProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
};

export const Styled = (defaultElement: ElementType, classes: string) => {
  const StyledComponent = <T extends ElementType = typeof defaultElement>({
    as,
    className,
    ...props
  }: StyledProps<T>) => {
    const Component = as ?? defaultElement;
    return <Component className={clsx(classes, className)} {...props} />;
  };
  return StyledComponent;
};
