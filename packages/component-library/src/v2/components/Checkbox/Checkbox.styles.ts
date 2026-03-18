import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-checkbox", (theme) => {
  let sizeVariants: SimpleStyleRules["key"] = {};

  for (const [size, styles] of Object.entries(theme.sizes.checkbox)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-size="${size}"]`]: {
        fontSize: styles.fontSize,
      },
    };
  }

  return {
    checkbox: {
      ...theme.flexHorizontalCenter({ inline: true }),

      "&:focus": {
        "& $indicator": {
          boxShadow: `0 0 0 3px ${theme.resolveThemeColor(theme.colors.focus)}`,
        },
        outline: "none",
      },

      "&:focus-visible": {
        "& $indicator": {
          boxShadow: `0 0 0 3px ${theme.resolveThemeColor(theme.colors.focus)}`,
        },
        outline: "none",
      },
      gap: theme.spacing(1),
    },
    indicator: {
      ...theme.flexHorizontalCenter({ inline: true }),

      "& > svg": {
        height: "1em",
        opacity: 0,
        transition: "opacity .2s ease",
        width: "auto",
      },
      border: `2px solid ${theme.resolveThemeColor(theme.colors.forms.input.border)}`,
      borderRadius: theme.tokens.borderRadius.sm,
      gap: theme.spacing(1),
      height: "1em",
      transition: "border-color .2s ease",
      width: "1em",
    },
    root: {
      ...theme.flexHorizontalCenter({ inline: true }),

      "&:hover": {
        "& $indicator": {
          borderColor: theme.resolveThemeColor(
            theme.colors.forms.input.hover.border,
          ),
        },
        cursor: "pointer",
      },

      '&[data-checked="true"]': {
        "& $indicator": {
          "& > svg": {
            opacity: 1,
          },
          backgroundColor: theme.palette.violet500,
          borderColor: theme.palette.violet500,
          color: theme.palette.white,
        },
      },
      gap: theme.spacing(1),

      ...sizeVariants,
    },
  };
});
