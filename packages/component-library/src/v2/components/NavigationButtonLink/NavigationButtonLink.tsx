import cx from "clsx";
import Link from "next/link";
import type { ComponentProps } from "react";

import type { ButtonProps } from "../Button";
import { Button } from "../Button";
import { classes } from "./NavigationButtonLink.styles";

type AnchorProps = ComponentProps<"a">;

export type NavigationButtonLinkProps = Omit<ButtonProps, "variant"> &
  Pick<AnchorProps, "target"> & {
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

export function NavigationButtonLink({
  active = false,
  className,
  href,
  ...rest
}: NavigationButtonLinkProps) {
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
