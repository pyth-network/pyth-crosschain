import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-text-component", (theme) => {
  let colorVariants: SimpleStyleRules["key"] = {};
  for (const [colorName, colorVal] of Object.entries(theme.palette)) {
    colorVariants = {
      ...colorVariants,
      [`&[data-color="${colorName}"]`]: {
        color: theme.lightDark(colorVal.light, colorVal.dark),
      },
    };
  }

  let boldVariants: SimpleStyleRules["key"] = {};

  for (const [boldName, boldVal] of Object.entries(theme.fontWeight)) {
    boldVariants = {
      ...boldVariants,
      [`&[data-bold="${boldName}"]`]: {
        fontWeight: boldVal,
      },
    };
  }

  return {
    root: {
      ...boldVariants,
      ...colorVariants,
      '&[data-italic="true"]': {
        fontStyle: "italic",
      },
    },
  };
});
