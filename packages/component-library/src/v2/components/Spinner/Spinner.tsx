import cx from "clsx";
import type { ComponentProps } from "react";

import { classes } from "./Spinner.styles";
import type { SpinnerSize } from "../../theme";

export type SpinnerProps = ComponentProps<"div"> & {
  size?: SpinnerSize;
};

export function Spinner({
  className,
  size = "md",
  children,
  ...rest
}: SpinnerProps) {
  return (
    <div
      {...rest}
      aria-busy="true"
      aria-live="polite"
      className={cx(classes.root, className)}
      data-size={size}
      role="status"
    >
      <span className={classes.spinner} aria-hidden={Boolean(children)} />
      {children && <span className={classes.label}>{children}</span>}
    </div>
  );
}
