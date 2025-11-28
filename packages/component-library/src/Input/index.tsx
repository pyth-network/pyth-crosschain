import cx from "clsx";
import type { ComponentProps } from "react";

import classes from "./index.module.scss";
import { Input as BaseInput } from "../unstyled/TextField/index.js";

type InputProps = ComponentProps<typeof BaseInput> & {
  /**
   * if true, will take up 100% of the available width
   *
   * @defaultValue false
   */
  fullWidth?: boolean;
};

export function Input({
  className: classNameOverride,
  fullWidth = false,
  ...rest
}: InputProps) {
  return (
    <BaseInput
      className={cx(classes.input, classNameOverride)}
      data-fullwidth={fullWidth}
      {...rest}
    />
  );
}
