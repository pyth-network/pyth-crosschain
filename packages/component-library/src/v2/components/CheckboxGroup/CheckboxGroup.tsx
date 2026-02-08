import { CheckboxGroup as BaseCheckboxGroup } from "@base-ui/react/checkbox-group";
import cx from "clsx";
import type { ReactNode } from "react";

import { Checkbox } from "../Checkbox";
import { classes } from "./CheckboxGroup.styles";

export type CheckboxGroupOption = {
  key: string;
  label: ReactNode;
  value: string;
};

export type CheckboxGroupProps = {
  className?: string;
  label: ReactNode;
  onChange: (newVal: string[]) => void;
  options: CheckboxGroupOption[];
  value: CheckboxGroupOption["value"][];
};

export function CheckboxGroup({
  className,
  label,
  onChange,
  options,
  value,
}: CheckboxGroupProps) {
  return (
    <BaseCheckboxGroup
      className={cx(classes.checkboxGroup, className)}
      value={value}
      onValueChange={onChange}
    >
      <div className={classes.label}>{label}</div>
      <div className={classes.checkboxes}>
        {options.map((opt) => (
          <Checkbox key={opt.key} value={opt} />
        ))}
      </div>
    </BaseCheckboxGroup>
  );
}
