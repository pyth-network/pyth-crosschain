import type { ComponentProps } from "react";

import type { ThemeV2 } from "../../theme";

export const cardElevations = ["default-1", "default-2", "primary-2"] as const;

export type CardElevation = (typeof cardElevations)[number];
export type CardSize = keyof typeof ThemeV2.sizes.card;

export type CardProps = ComponentProps<"div"> & {
  /**
   * box shadow style applied to the card
   *
   * @defaultValue "default-1"
   */
  elevation?: CardElevation;

  /**
   * size of the card spacing
   *
   * @defaultValue "md"
   */
  size?: CardSize;
};
