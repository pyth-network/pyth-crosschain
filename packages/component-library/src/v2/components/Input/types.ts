import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import type { ThemeV2 } from "../../theme";

export type InputSizeVariant = keyof typeof ThemeV2.fontSize;

export type InputProps = Omit<ComponentProps<typeof BaseInput>, "size"> & {
  /**
   * if true, will take up 100% of the available width
   *
   * @defaultValue false
   */
  fullWidth?: boolean;

  /**
   * which size input to display
   *
   * @defaultValue 'base'
   */
  size?: InputSizeVariant;
};
