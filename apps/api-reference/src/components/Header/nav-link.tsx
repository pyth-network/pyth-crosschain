"use client";

import clsx from "clsx";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";
import { useMemo } from "react";

const baseClasses = "font-semibold text-sm py-2 px-3";

type NavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  target?: "_blank" | "_self";
};

export const NavLink = ({ className, ...props }: NavLinkProps) => {
  const isCurrent = useIsCurrent(props.href);

  return isCurrent ? (
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

const useIsCurrent = (href: string) => {
  const selectedSegment = useSelectedLayoutSegment();
  return useMemo(
    () => href.toString().split("/")[1] === selectedSegment,
    [href, selectedSegment],
  );
};
