import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-button", (theme) => {
  let buttonVariants: SimpleStyleRules["key"] = {};
  let sizeVariants: SimpleStyleRules["key"] = {};

  for (const [variant, rules] of Object.entries(theme.color.button)) {
    buttonVariants = {
      ...buttonVariants,
      [`&[data-buttonvariant="${variant}"]`]: {
        backgroundColor: rules.background.primary,
        color: rules.foreground.primary,
        outline: rules.outline,
        transition: "background-color .2s ease, color .2s ease",

        "&:hover": {
          backgroundColor: rules.background.hover,
          color: rules.foreground.hover,
        },
      },
    };
  }

  for (const [size, fontSize] of Object.entries(theme.fontSize)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-buttonsize="${size}"]`]: {
        fontSize: fontSize,
        padding: `calc(${fontSize} / 2) ${fontSize}`,
      },
    };
  }

  return {
    /**
     * icon displayed to the left of the button text
     */
    leftIcon: {
      height: "1em",
      width: "auto",
    },

    /**
     * class name applied to a tooltip that wraps
     * around a button, if specified
     */
    tooltip: {
      ...theme.tooltipStyles(),
    },

    /**
     * root of the button
     */
    root: {
      alignItems: "center",
      border: "none",
      borderRadius: theme.borderRadius.lg,
      display: "inline-flex",
      gap: theme.spacing(2),
      fontSize: theme.fontSize.base,
      fontFamily: theme.fontFamily.normal,
      padding: `${theme.spacing(2)} ${theme.spacing(4)}`,

      "&:hover": {
        cursor: "pointer",
      },

      ...buttonVariants,
      ...sizeVariants,
    },
  };
});
