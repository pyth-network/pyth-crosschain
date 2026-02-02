import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-input", (theme) => {
  const inputContainerStyles: SimpleStyleRules["key"] = {
    display: "inline-flex",
    flexFlow: "column",
    gap: theme.spacing(1),
  };

  let sizeVariants: SimpleStyleRules["key"] = {};

  const inputSizes = {
    xs: {
      fontSize: theme.tokens.fontSizes.xxs,
      padding: `${theme.spacing(0.5)} ${theme.spacing(2)}`,
      height: theme.spacing(6),
    },
    sm: {
      fontSize: theme.tokens.fontSizes.xs,
      padding: `${theme.spacing(0.75)} ${theme.spacing(2.5)}`,
      height: theme.spacing(8),
    },
    md: {
      fontSize: theme.tokens.fontSizes.sm,
      padding: `${theme.spacing(1)} ${theme.spacing(3)}`,
      height: theme.spacing(10),
    },
    lg: {
      fontSize: theme.tokens.fontSizes.base,
      padding: `${theme.spacing(1.25)} ${theme.spacing(4)}`,
      height: theme.spacing(12),
    },
  } as const;

  for (const [size, styles] of Object.entries(inputSizes)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-size="${size}"] $input`]: {
        borderRadius: theme.tokens.borderRadius.lg,
        fontSize: styles.fontSize,
        padding: styles.padding,
        height: styles.height,
      },
    };
  }

  return {
    /**
     * class name applied to the input, itself
     */
    input: {
      border: `1px solid ${theme.resolveThemeColor(theme.colors.forms.input.border)}`,
      borderRadius: theme.tokens.borderRadius.lg,
      // need to be explicit with the font family
      fontFamily: theme.tokens.fontFamilies.normal,
      padding: `${theme.spacing(1)} ${theme.spacing(3)}`,
      transition:
        "background-color .2s ease, box-shadow .2s ease, color .2s ease",

      "&::placeholder": {
        color: theme.resolveThemeColor(theme.colors.forms.input.placeholder),
      },

      "&:focus": {
        boxShadow: `0 0 0 3px ${theme.resolveThemeColor(theme.colors.focus)}`,
        outline: "none",
      },

      "&:disabled": {
        backgroundColor: theme.resolveThemeColor(
          theme.colors.forms.input.disabled.background,
        ),
        color: theme.resolveThemeColor(
          theme.colors.forms.input.disabled.foreground,
        ),
        cursor: "not-allowed",

        "&::placeholder": {
          color: theme.resolveThemeColor(
            theme.colors.forms.input.disabled.placeholder,
          ),
        },
      },
    },
    /**
     * class name applied to the optional label that appears above
     * the text input
     */
    label: {
      fontSize: theme.tokens.fontSizes.sm,
    },
    /**
     * class name applied to Field root that wraps around the input
     */
    root: {
      ...inputContainerStyles,

      "&:hover": {
        "& $input": {
          borderColor: theme.resolveThemeColor(
            theme.colors.forms.input.hover.border,
          ),
        },
      },

      '&[data-haslabel="true"]': {
        "& $label": {
          ...inputContainerStyles,
          color: theme.resolveThemeColor(theme.colors.muted),
        },
      },

      ...sizeVariants,
    },
  };
});
