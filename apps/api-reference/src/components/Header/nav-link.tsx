"use client";

import clsx from "clsx";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";

const baseClasses = "font-semibold text-sm py-2 px-3";

export const NavLink = ({
  className,
  ...props
}: ComponentProps<typeof Link>) => {
  const segment = useSelectedLayoutSegment();
  return segment && `/${segment}` === props.href ? (
    <span
      className={clsx(
        "text-pythpurple-600 dark:text-pythpurple-400",
        baseClasses,
        className,
      )}
    >
      {props.children}
    </span>
  ) : (
    <Link
      className={clsx(
        "text-neutral-700 hover:text-pythpurple-600 dark:text-neutral-400 dark:hover:text-pythpurple-400",
        baseClasses,
        className,
      )}
      {...props}
    />
  );
};
