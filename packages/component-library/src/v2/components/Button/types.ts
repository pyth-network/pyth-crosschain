import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";

import type { ThemeV2 } from "../../theme";

export type ButtonVariant = keyof typeof ThemeV2.color.button;

export type ButtonSizeVariant = keyof typeof ThemeV2.fontSize;

export type ButtonProps = ComponentProps<typeof BaseButton> & {
  /**
   * which size button to display
   *
   * @defaultValue 'base'
   */
  size?: ButtonSizeVariant;

  /**
   * which type of button to display
   *
   * @defaultValue 'primary'
   */
  variant?: ButtonVariant;
};
