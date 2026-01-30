import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-badge", (theme) => {
  let variantStyles: SimpleStyleRules["key"] = {};
  for (const [variant, values] of Object.entries(theme.colors.states)) {
    const background = theme.resolveThemeColor(values.background);
    const border = theme.resolveThemeColor(values.border);

    variantStyles = {
      ...variantStyles,
      [`&[data-variant="${variant}"]`]: {
        borderColor: border,

        '&[data-style="filled"]': {
          background: background,
        },

        color: theme.resolveThemeColor(
          theme.colors.foreground,
          variant === "neutral",
        ),
      },
    };
  }

  const mutedColor = theme.resolveThemeColor(theme.colors.muted);

  return {
    root: {
      alignItems: "center",
      borderRadius: theme.tokens.borderRadius.xxxl,
      borderStyle: "solid",
      borderWidth: "1px",
      color: theme.resolveThemeColor(theme.colors.foreground),
      display: "inline-flex",
      flexFlow: "row nowrap",
      justifyContent: "center",
      lineHeight: "normal",
      transitionDuration: "100ms",
      transitionProperty: "color, background-color, border-color",
      transitionTimingFunction: "linear",
      whiteSpace: "nowrap",

      '&[data-size="xs"]': {
        fontSize: theme.tokens.fontSizes.xxs,
        fontWeight: theme.tokens.fontWeights.medium,
        height: theme.spacing(4),
        padding: `0 ${theme.spacing(2)}`,
      },

      '&[data-size="md"]': {
        fontSize: theme.tokens.fontSizes.xs,
        fontWeight: theme.tokens.fontWeights.medium,
        height: theme.spacing(6),
        padding: `0 ${theme.spacing(3)}`,
      },

      '&[data-size="lg"]': {
        fontSize: theme.tokens.fontSizes.sm,
        fontWeight: theme.tokens.fontWeights.semibold,
        height: theme.spacing(9),
        padding: `0 ${theme.spacing(5)}`,
      },

      '&[data-variant="muted"]': {
        borderColor: mutedColor,

        '&[data-style="filled"]': {
          background: mutedColor,
        },

        '&[data-style="outline"]': {
          color: mutedColor,
        },
      },

      '&[data-style="filled"]': {
        color: theme.resolveThemeColor(theme.colors.background.primary),
      },

      ...variantStyles,
    },
  };
});
