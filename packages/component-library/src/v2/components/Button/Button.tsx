import { Button as BaseButton } from "@base-ui/react/button";
import cx from "clsx";

import { classes } from "./component.styles";
import type { ButtonProps } from "./types";

export function Button({
  className,
  size = "base",
  variant = "primary",
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      {...rest}
      className={cx(classes.root, className)}
      data-buttonvariant={variant}
      data-buttonsize={size}
    />
  );
}
