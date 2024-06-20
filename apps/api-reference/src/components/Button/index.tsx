import clsx from "clsx";
import type { ComponentProps, ElementType } from "react";

type ButtonProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
  loading?: boolean | undefined;
};

export const Button = <T extends ElementType>({
  as,
  className,
  loading,
  disabled,
  ...props
}: ButtonProps<T>) => {
  const Component = as ?? "button";
  return (
    <Component
      disabled={loading === true || disabled === true}
      className={clsx(
        "rounded-lg border text-sm font-medium transition-all duration-300",
        {
          "border-neutral-400 bg-pythpurple-600/5 hover:border-pythpurple-600 hover:bg-pythpurple-600/15 hover:shadow-md dark:border-neutral-600 dark:bg-pythpurple-400/5 dark:hover:border-pythpurple-400 dark:hover:bg-pythpurple-400/15 dark:hover:shadow-white/20":
            !loading && !disabled,
        },
        {
          "border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500":
            loading === true || disabled === true,
        },
        { "cursor-not-allowed": disabled === true && loading !== true },
        { "cursor-wait": loading === true },
        className,
      )}
      {...props}
    />
  );
};
