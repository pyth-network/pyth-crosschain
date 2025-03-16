"use client";

import clsx from "clsx";
import type {
  ComponentProps,
  ElementType,
  MouseEvent,
  CSSProperties,
} from "react";
import { useState, useCallback } from "react";

const DEFAULT_GRADIENT_SIZE = "30rem";

type ButtonProps<T extends ElementType> = Omit<ComponentProps<T>, "as"> & {
  as?: T;
  loading?: boolean | undefined;
  gradient?: boolean | undefined;
} & (
    | { gradient?: false | undefined }
    | {
        gradient: true;
        gradientSize?: string | undefined;
      }
  );

export const Button = <T extends ElementType>({
  as,
  className,
  loading,
  disabled,
  gradient,
  children,
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
      className={clsx(
        "group relative overflow-hidden rounded-lg border text-sm font-medium transition-all duration-300",
        {
          "border-neutral-400 hover:border-pythpurple-600 hover:shadow-md dark:border-neutral-600 dark:hover:border-pythpurple-400 dark:hover:shadow-white/20":
            !loading && !disabled,
          "bg-pythpurple-600/5 hover:bg-pythpurple-600/15 dark:bg-pythpurple-400/5 dark:hover:bg-pythpurple-400/15":
            !gradient && !loading && !disabled,
          "active:bg-pythpurple-400/10 dark:active:bg-pythpurple-600/10":
            gradient && !loading && !disabled,
          "border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500":
            loading === true || disabled === true,
          "cursor-not-allowed": disabled === true && loading !== true,
          "cursor-wait": loading === true,
        },
        className,
      )}
      {...props}
    >
      {gradient && !loading && !disabled && (
        <Gradient size={props.gradientSize} x={mouse.x} y={mouse.y} />
      )}
      {children}
    </Component>
  );
};

type GradientProps = {
  x: number;
  y: number;
  size?: string | undefined;
};

const Gradient = ({ size = DEFAULT_GRADIENT_SIZE, x, y }: GradientProps) => (
  <div
    style={
      {
        "--gradient-left": `${x.toString()}px`,
        "--gradient-top": `${y.toString()}px`,
        "--gradient-size": size,
      } as CSSProperties
    }
    className="pointer-events-none absolute left-0 top-0 -z-10 ml-[calc(-1_*_var(--gradient-size)_/_2)] mt-[calc(-1_*_var(--gradient-size)_/_2)] block size-[var(--gradient-size)] translate-x-[var(--gradient-left)] translate-y-[var(--gradient-top)]"
  >
    <div className="size-full scale-0 bg-gradient-radial from-pythpurple-400 to-70% opacity-10 transition duration-500 group-hover:scale-100 group-hover:opacity-30 group-active:scale-150 group-active:opacity-40 dark:from-pythpurple-600" />
  </div>
);
