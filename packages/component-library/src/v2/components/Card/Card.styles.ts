import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-card", (theme) => {
  let elevationVariants: SimpleStyleRules["key"] = {};
  let sizeVariants: SimpleStyleRules["key"] = {};
  const cardElevations = {
    "default-1": theme.elevations.default[1],
    "default-2": theme.elevations.default[2],
    "primary-2": theme.elevations.primary[2],
  } as const;

  for (const [elevation, shadow] of Object.entries(cardElevations)) {
    elevationVariants = {
      ...elevationVariants,
      [`&[data-elevation="${elevation}"]`]: {
        boxShadow: shadow,
      },
    };
  }

  for (const [size, sizes] of Object.entries(theme.cardSizes)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-size="${size}"]`]: {
        borderRadius: sizes.borderRadius,
        padding: sizes.padding,
      },
    };
  }

  return {
    root: {
      backgroundColor: theme.resolveThemeColor(theme.colors.card.background),
      border: `1px solid ${theme.resolveThemeColor(theme.colors.border)}`,
      display: "flex",
      flexFlow: "column",
      ...elevationVariants,
      ...sizeVariants,
    },
  };
});
