import { Input as BaseInput } from "@base-ui/react/input";
import cx from "clsx";

import { classes } from "./Input.styles";
import type { InputProps } from "./types";

export function Input({ className, fullWidth = false, size = "base", ...rest }: InputProps) {
  return (
    <BaseInput
      {...rest}
      className={cx(classes.root, className)}
      data-fullwidth={fullWidth}
      data-inputsize={size}
    />
  );
}

export { type InputProps } from "./types";
