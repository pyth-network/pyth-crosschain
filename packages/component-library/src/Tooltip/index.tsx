import cx from "clsx";
import type { PropsWithChildren, ReactNode } from "react";
import type {
  TooltipTriggerComponentProps,
  TooltipProps as AriaTooltipProps,
} from "react-aria-components";
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";

import classes from "./index.module.scss";

export type TooltipProps = PropsWithChildren &
  Omit<TooltipTriggerComponentProps, "children"> & {
    /**
     * The content to display in the actual tooltip
     */
    label: ReactNode;

    /**
     * Additional options to apply directly to the tooltip
     * popover
     */
    tooltipProps?: AriaTooltipProps;
  };

export function Tooltip({
  children,
  label,
  tooltipProps,
  ...rest
}: TooltipProps) {
  return (
    <TooltipTrigger {...rest}>
      {children}
      <AriaTooltip
        className={cx(classes.tooltipRoot, tooltipProps?.className)}
        placement={tooltipProps?.placement ?? "bottom"}
      >
        {label}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
