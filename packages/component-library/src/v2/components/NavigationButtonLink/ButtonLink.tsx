import cx from "clsx";
import Link from "next/link";
import type { ComponentProps } from "react";

import type { ButtonProps } from "../Button";
import { Button } from "../Button";
import { classes } from "./ButtonLink.styles";

export type ButtonLinkProps = Omit<ButtonProps, "variant"> &
  Pick<ComponentProps<"a">, "target"> & {
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

export function ButtonLink({
  active = false,
  className,
  href,
  ...rest
}: ButtonLinkProps) {
  return (
    <Button
      {...rest}
      data-active={active}
      data-leftnavlink
      className={cx(classes.root, className)}
      nativeButton={false}
      render={<Link href={href} prefetch={false} />}
    />
  );
}
