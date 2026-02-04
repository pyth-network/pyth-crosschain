/** biome-ignore-all lint/a11y/noLabelWithoutControl: base-ui doesn't require this */

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Field } from "@base-ui/react/field";
import { Check } from "@phosphor-icons/react/dist/ssr";
import cx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { classes } from "./Checkbox.styles";
import type { InputSize } from "../../theme/theme";

export type Checkboxvalue = {
  key: string;
  label?: ReactNode;
  value: string;
};

export type CheckboxProps = Omit<
  ComponentProps<typeof BaseCheckbox.Root>,
  "value" | "size"
> & {
  className?: string;
  value?: Checkboxvalue;
  label?: ReactNode;
  size?: InputSize;
};

export function Checkbox({
  className,
  value: opt,
  label,
  size = "md",
  ...rest
}: CheckboxProps) {
  const resolvedLabel = label ?? opt?.label;

  return (
    <Field.Root
      className={cx(className, classes.root)}
      data-checked={rest.checked ?? false}
      data-haslabel={Boolean(resolvedLabel)}
      data-size={size}
    >
      <BaseCheckbox.Root
        {...rest}
        className={classes.checkbox}
        value={opt?.value ?? ""}
      >
        <BaseCheckbox.Indicator className={classes.indicator} keepMounted>
          <Check />
        </BaseCheckbox.Indicator>
        {resolvedLabel}
      </BaseCheckbox.Root>
    </Field.Root>
  );
}
