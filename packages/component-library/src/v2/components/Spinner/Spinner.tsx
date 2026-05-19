import cx from "clsx";
import type { ComponentProps } from "react";
import type { SpinnerSize } from "../../theme";
import { classes } from "./Spinner.styles";

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
      <span aria-hidden={Boolean(children)} className={classes.spinner} />
      {children && <span className={classes.label}>{children}</span>}
    </div>
  );
}
