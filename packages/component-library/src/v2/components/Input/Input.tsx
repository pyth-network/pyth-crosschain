import { Field } from "@base-ui/react/field";
import type { InputProps as BaseInputProps } from "@base-ui/react/input";
import { Input as BaseInput } from "@base-ui/react/input";
import type { Icon } from "@phosphor-icons/react";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import cx from "clsx";
import type { ReactNode } from "react";

import { classes } from "./Input.styles";
import type { InputSize } from "../../theme/theme";

export type InputProps = Omit<BaseInputProps, "size"> & {
  afterIcon?: Icon;
  beforeIcon?: Icon;
  label?: Nullish<ReactNode>;
  labelClassName?: string;
  inputClassName?: string;
  size?: InputSize;
};

export function Input({
  afterIcon: AfterIcon,
  beforeIcon: BeforeIcon,
  className,
  inputClassName,
  label,
  labelClassName,
  size = "md",
  ...rest
}: InputProps) {
  const inputComponent = (
    <span className={classes.inputWrapper}>
      {BeforeIcon && (
        <span className={classes.beforeIcon}>
          <BeforeIcon />
        </span>
      )}
      <BaseInput className={cx(classes.input, inputClassName)} {...rest} />
      {AfterIcon && (
        <span className={classes.afterIcon}>
          <AfterIcon />
        </span>
      )}
    </span>
  );

  return (
    <Field.Root
      className={cx(classes.root, className)}
      data-haslabel={Boolean(label)}
      data-hasaftericon={Boolean(AfterIcon)}
      data-hasbeforeicon={Boolean(BeforeIcon)}
      data-size={size}
    >
      {label ? (
        <Field.Label className={cx(classes.label, labelClassName)}>
          {label}
          {inputComponent}
        </Field.Label>
      ) : (
        inputComponent
      )}
    </Field.Root>
  );
}
