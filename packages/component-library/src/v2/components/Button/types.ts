import { Button as BaseButton } from "@base-ui/react/button";
import type { TooltipPositionerProps } from "@base-ui/react/tooltip";
import type { Icon } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";

import type { ThemeV2 } from "../../theme";

export type ButtonVariant = keyof typeof ThemeV2.color.button;

export type ButtonSizeVariant = keyof typeof ThemeV2.fontSize;

export type ButtonProps = ComponentProps<typeof BaseButton> & {
  /**
   * if provided, displays this icon to the left of the
   * button content as a prefix
   */
  leftIcon?: Icon;

  /**
   * which size button to display
   *
   * @defaultValue 'base'
   */
  size?: ButtonSizeVariant;

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
