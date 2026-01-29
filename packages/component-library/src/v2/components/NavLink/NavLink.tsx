import cx from "clsx";
import Link from "next/link";

import type { ButtonProps } from "../Button";
import { Button } from "../Button";
import { classes } from "./NavLink.styles";

export type NavLinkProps = Omit<ButtonProps, "size" | "variant"> & {
  /**
   * if set, indicates that this is the current route
   * and that the styling should be changed to reflect this
   *
   * @defaultValue false
   */
  active?: boolean;

  /**
   * URL or path for navigation
   */
  href: string;
};

export function NavLink({
  active = false,
  className,
  href,
  ...rest
}: NavLinkProps) {
  return (
    <Button
      {...rest}
      data-active={active}
      data-leftnavlink
      className={cx(classes.root, className)}
      render={<Link href={href} prefetch={false} />}
    />
  );
}
