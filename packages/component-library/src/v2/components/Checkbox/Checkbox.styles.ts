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
      gap: theme.spacing(1),

      "&:focus": {
        outline: "none",

        "& $indicator": {
          boxShadow: `0 0 0 3px ${theme.resolveThemeColor(theme.colors.focus)}`,
        },
      },

      "&:focus-visible": {
        outline: "none",

        "& $indicator": {
          boxShadow: `0 0 0 3px ${theme.resolveThemeColor(theme.colors.focus)}`,
        },
      },
    },
    indicator: {
      ...theme.flexHorizontalCenter({ inline: true }),
      border: `2px solid ${theme.resolveThemeColor(theme.colors.forms.input.border)}`,
      borderRadius: theme.tokens.borderRadius.sm,
      height: "1em",
      gap: theme.spacing(1),
      transition: "border-color .2s ease",
      width: "1em",

      "& > svg": {
        height: "1em",
        opacity: 0,
        transition: "opacity .2s ease",
        width: "auto",
      },
    },
    root: {
      ...theme.flexHorizontalCenter({ inline: true }),
      gap: theme.spacing(1),

      '&[data-checked="true"]': {
        "& $indicator": {
          backgroundColor: theme.palette.violet500,
          borderColor: theme.palette.violet500,
          color: theme.palette.white,

          "& > svg": {
            opacity: 1,
          },
        },
      },

      "&:hover": {
        cursor: "pointer",

        "& $indicator": {
          borderColor: theme.resolveThemeColor(
            theme.colors.forms.input.hover.border,
          ),
        },
      },

      ...sizeVariants,
    },
  };
});
