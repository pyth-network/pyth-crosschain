import cx from "clsx";
import type { ComponentProps } from "react";
import { Input as BaseInput } from "../unstyled/TextField/index.js";
import classes from "./index.module.scss";

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
