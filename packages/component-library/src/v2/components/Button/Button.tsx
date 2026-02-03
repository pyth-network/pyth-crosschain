import { Button as BaseButton } from "@base-ui/react/button";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import cx from "clsx";
import type { ComponentProps } from "react";

import { classes } from "./Button.styles";
import type { ButtonProps } from "./types";

export function Button({
  afterIcon: AfterIcon,
  beforeIcon: BeforeIcon,
  children,
  className,
  size = "md",
  tooltip,
  tooltipDelay = 50,
  tooltipPositionerProps,
  variant = "primary",
  ...rest
}: ButtonProps) {
  const propsToSpread = {
    ...rest,
    className: cx(classes.root, className),
    "data-buttonvariant": variant,
    "data-buttonsize": size,
  };

  if (tooltip) {
    return (
      <BaseTooltip.Provider delay={tooltipDelay}>
        <BaseTooltip.Root>
          <BaseTooltip.Trigger
            {...(propsToSpread as unknown as ComponentProps<BaseTooltip.Trigger>)}
          >
            {BeforeIcon && (
              <BeforeIcon className={classes.icon} data-beforeicon />
            )}
            {children}
            {AfterIcon && <AfterIcon className={classes.icon} data-aftericon />}
          </BaseTooltip.Trigger>
          <BaseTooltip.Portal>
            <BaseTooltip.Positioner {...tooltipPositionerProps}>
              <BaseTooltip.Popup className={classes.tooltip}>
                {tooltip}
              </BaseTooltip.Popup>
            </BaseTooltip.Positioner>
          </BaseTooltip.Portal>
        </BaseTooltip.Root>
      </BaseTooltip.Provider>
    );
  }

  return (
    <BaseButton {...propsToSpread}>
      {BeforeIcon && <BeforeIcon className={classes.icon} data-beforeicon />}
      {children}
      {AfterIcon && <AfterIcon className={classes.icon} data-aftericon />}
    </BaseButton>
  );
}

export { type ButtonProps } from "./types";
