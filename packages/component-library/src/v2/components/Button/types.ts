import { Button as BaseButton } from "@base-ui/react/button";
import type { TooltipPositionerProps } from "@base-ui/react/tooltip";
import type { Icon } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";

import type { ButtonSize } from "../../../styles/theme";

export const buttonVariants = [
  "primary",
  "secondary",
  "outline",
  "ghost",
] as const;

export type ButtonVariant = (typeof buttonVariants)[number];

export type ButtonProps = ComponentProps<typeof BaseButton> & {
  /**
   * if provided, displays this icon to the right of the
   * button content as a suffix
   */
  afterIcon?: Icon;

  /**
   * if provided, displays this icon to the left of the
   * button content as a prefix
   */
  beforeIcon?: Icon;

  /**
   * which size button to display
   *
   * @defaultValue 'base'
   */
  size?: ButtonSize;

  /**
   * if specified, will wrap the button
   * with a tooltip and display it on hover
   */
  tooltip?: ReactNode;

  /**
   * determines how long it takes for a tooltip to appear
   * after mousing over
   *
   * @defaultValue 50
   */
  tooltipDelay?: number;

  /**
   * additional customizations for the positioner
   */
  tooltipPositionerProps?: TooltipPositionerProps;

  /**
   * which type of button to display
   *
   * @defaultValue 'primary'
   */
  variant?: ButtonVariant;
};

export type IconButtonProps = Omit<
  ButtonProps,
  "afterIcon" | "beforeIcon" | "children"
> & {
  icon: Icon;
};
