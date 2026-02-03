import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-input", (theme) => {
  const inputContainerStyles: SimpleStyleRules["key"] = {
    display: "inline-flex",
    flexFlow: "column",
    gap: theme.spacing(1),
    position: "relative",
  };

  let sizeVariants: SimpleStyleRules["key"] = {};

  for (const [size, styles] of Object.entries(theme.sizes.formField)) {
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
     * class name applied to the icon that is visible to the right-side of the input
     */
    afterIcon: {
      ...theme.flexHorizontalCenter(),
      bottom: 0,
      justifyContent: "center",
      position: "absolute",
      right: 0,
      top: 0,
      width: "2.5em",

      "& > svg": {
        height: "auto",
        width: "50%",
      },
    },

    /**
     * class name applied to the icon that is visible to the left-side of the input
     */
    beforeIcon: {
      ...theme.flexHorizontalCenter(),
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      top: 0,
      width: "2.5em",

      "& > svg": {
        height: "auto",
        width: "50%",
      },
    },

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

      width: "100%",

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
    inputWrapper: {
      display: "inline-block",
      position: "relative",
      width: "100%",
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

      '&[data-hasbeforeicon="true"]': {
        "& $inputWrapper > $input": {
          paddingLeft: "2em",
        },
      },

      '&[data-hasaftericon="true"]': {
        "& $inputWrapper > $input": {
          paddingRight: "2em",
        },
      },

      ...sizeVariants,
    },
  };
});
