"use client";

import clsx from "clsx";
import {
  type ComponentProps,
  type ElementType,
  type MouseEvent,
  useState,
  useCallback,
  type CSSProperties,
} from "react";

type ButtonProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
  loading?: boolean | undefined;
  gradient?: boolean | undefined;
};

export const Button = <T extends ElementType>({
  as,
  className,
  loading,
  disabled,
  gradient,
  ...props
}: ButtonProps<T>) => {
  const Component = as ?? "button";
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const updateMouse = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    setMouse({
      x: e.pageX - e.currentTarget.offsetLeft,
      y: e.pageY - e.currentTarget.offsetTop,
    });
  }, []);

  return (
    <Component
      disabled={loading === true || disabled === true}
      onMouseMove={updateMouse}
      style={
        gradient
          ? ({
              "--gradient-left": `${mouse.x.toString()}px`,
              "--gradient-top": `${mouse.y.toString()}px`,
            } as CSSProperties)
          : {}
      }
      className={clsx(
        "relative overflow-hidden rounded-lg border text-sm font-medium transition-all duration-300",
        {
          "border-neutral-400 hover:border-pythpurple-600 hover:shadow-md dark:border-neutral-600 dark:hover:border-pythpurple-400 dark:hover:shadow-white/20":
            !loading && !disabled,
          "before:absolute before:left-[var(--gradient-left)] before:top-[var(--gradient-top)] before:-ml-[20rem] before:-mt-[20rem] before:block before:size-[40rem] before:scale-0 before:bg-gradient-radial before:from-pythpurple-400/30 before:to-70% before:opacity-50 before:transition before:duration-500 hover:before:scale-100 hover:before:opacity-100 dark:before:from-pythpurple-600/30":
            gradient && !loading && !disabled,
          "bg-pythpurple-600/5 hover:bg-pythpurple-600/15 dark:bg-pythpurple-400/5 dark:hover:bg-pythpurple-400/15":
            !gradient && !loading && !disabled,
          "border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500":
            loading === true || disabled === true,
          "cursor-not-allowed": disabled === true && loading !== true,
          "cursor-wait": loading === true,
        },
        className,
      )}
      {...props}
    />
  );
};
