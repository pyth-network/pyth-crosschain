/** biome-ignore-all lint/a11y/noLabelWithoutControl: base-ui doesn't require this */

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { CheckSquare, Square } from "@phosphor-icons/react/dist/ssr";
import cx from "clsx";
import type { ComponentProps, ReactNode } from "react";

import { classes } from "./Checkbox.styles";

export type Checkboxvalue = {
  key: string;
  label?: ReactNode;
  value: string;
};

export type CheckboxProps = Omit<
  ComponentProps<typeof BaseCheckbox.Root>,
  "value"
> & {
  className?: string;
  value?: Checkboxvalue;
  label?: ReactNode;
};

export function Checkbox({
  className,
  value: opt,
  label,
  ...rest
}: CheckboxProps) {
  const resolvedLabel = label ?? opt?.label;
  const isCompact = !resolvedLabel;

  return (
    <label className={classes.wrapper} data-compact={isCompact}>
      <BaseCheckbox.Root
        {...rest}
        className={cx(classes.root, className)}
        data-compact={isCompact}
        value={opt?.value}
      >
        <span className={classes.iconSlot}>
          <Square
            className={classes.uncheckedIcon}
            data-checkbox-icon="unchecked"
          />
          <BaseCheckbox.Indicator
            keepMounted
            className={classes.checkedIndicator}
            data-checkbox-icon="checked"
          >
            <CheckSquare className={classes.checkedIcon} />
          </BaseCheckbox.Indicator>
        </span>
        {resolvedLabel}
      </BaseCheckbox.Root>
    </label>
  );
}
