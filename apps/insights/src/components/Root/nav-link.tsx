"use client";

import { Link } from "@pythnetwork/component-library/unstyled/Link";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  href: string;
  target?: string | undefined;
  className?: string | undefined;
  children?: ReactNode | ReactNode[] | undefined;
};

export const NavLink = ({ href, target, className, children }: Props) => {
  const layoutSegment = useSelectedLayoutSegment();

  return `/${layoutSegment ?? ""}` === href ? (
    <div data-selected="" className={className}>
      {children}
    </div>
  ) : (
    <Link
      href={href}
      {...(target !== undefined && { target })}
      {...(className !== undefined && { className })}
    >
      {children}
    </Link>
  );
};
