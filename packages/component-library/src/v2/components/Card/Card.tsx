import cx from "clsx";

import { classes } from "./Card.styles";
import type { CardProps } from "./types";

export function Card({
  children,
  className,
  elevation = "default-1",
  size = "md",
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={cx(classes.root, className)}
      data-elevation={elevation}
      data-size={size}
    >
      {children}
    </div>
  );
}
