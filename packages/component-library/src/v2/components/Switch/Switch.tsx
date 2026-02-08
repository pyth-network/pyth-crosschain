import { Field } from "@base-ui/react/field";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type { Icon } from "@phosphor-icons/react";
import { NOOP_NULL } from "@pythnetwork/shared-lib/constants";
import cx from "clsx";
import type { ReactNode } from "react";

import { classes } from "./Switch.styles";

type IconToggle = {
  children?: never;
  offIcon: Icon;
  onIcon: Icon;
  variant: "icon";
};

type NormalToggle = {
  children: ReactNode;
  offIcon?: never;
  onIcon?: never;
  /**
   * Optional: defaults to 'normal' behavior if omitted
   */
  variant?: "normal";
};

export type ToggleProps = {
  className?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
} & (IconToggle | NormalToggle);

export function Toggle(props: ToggleProps) {
  /** local variables */
  const { checked, className, onChange } = props;

  const OffIcon = props.variant === "icon" ? props.offIcon : NOOP_NULL;
  const OnIcon = props.variant === "icon" ? props.onIcon : NOOP_NULL;

  return (
    <Field.Root
      className={cx(classes.root, className)}
      data-variant={props.variant ?? "normal"}
      render={<span />}
    >
      <Field.Label>
        <BaseSwitch.Root
          className={classes.switch}
          checked={checked}
          onCheckedChange={onChange}
        >
          <BaseSwitch.Thumb className={classes.thumb}>
            {props.variant === "icon" && (
              <>
                <span>
                  <OffIcon />
                </span>
                <span>
                  <OnIcon />
                </span>
              </>
            )}
          </BaseSwitch.Thumb>
          <OffIcon />
          <OnIcon />
        </BaseSwitch.Root>
      </Field.Label>
    </Field.Root>
  );
}
