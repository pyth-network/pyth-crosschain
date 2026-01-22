import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-input", (theme) => {
  let sizeVariants: SimpleStyleRules["key"] = {};

  for (const [size, fontSize] of Object.entries(theme.fontSize)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-inputsize="${size}"]`]: {
        fontSize: fontSize,
        padding: `calc(${fontSize} / 2) ${fontSize}`,
      },
    };
  }

  return {
    root: {
      backgroundColor: theme.lightDark(
        theme.palette.inputBackground.primary.light,
        theme.palette.inputBackground.primary.dark,
      ),
      border: `1px solid ${theme.lightDark(theme.palette.border.primary.light, theme.palette.border.primary.dark)}`,
      borderRadius: theme.borderRadius.md,
      caretColor: theme.lightDark(
        theme.palette.ring.primary.light,
        theme.palette.ring.primary.dark,
      ),
      color: theme.lightDark(
        theme.palette.foreground.primary.light,
        theme.palette.foreground.primary.dark,
      ),
      display: "inline-block",
      fontFamily: theme.fontFamily.normal,
      fontSize: theme.fontSize.base,
      outline: `${theme.spacing(1)} solid transparent`,
      outlineOffset: 0,
      overflow: "hidden",
      padding: theme.spacing(2),
      textOverflow: "ellipsis",
      transition:
        "border-color 100ms linear, outline-color 100ms linear, background-color 100ms linear, color 100ms linear",
      whiteSpace: "nowrap",

      "&::placeholder": {
        color: theme.lightDark(
          theme.palette.mutedForeground.primary.light,
          theme.palette.mutedForeground.primary.dark,
        ),
      },

      "&:hover": {
        borderColor: theme.lightDark(
          theme.blendColor(theme.palette.border.primary.light, "black", 0.3),
          theme.blendColor(theme.palette.border.primary.dark, "white", 0.3),
        ),
      },

      "&:focus": {
        borderColor: theme.lightDark(
          theme.palette.ring.primary.light,
          theme.palette.ring.primary.dark,
        ),
        outlineColor: theme.lightDark(
          theme.blendColor(theme.palette.ring.primary.light, "white", 0.5),
          theme.blendColor(theme.palette.ring.primary.dark, "black", 0.5),
        ),
      },

      "&:disabled": {
        backgroundColor: theme.lightDark(
          theme.palette.muted.primary.light,
          theme.palette.muted.primary.dark,
        ),
        borderColor: "transparent",
        color: theme.lightDark(
          theme.palette.mutedForeground.primary.light,
          theme.palette.mutedForeground.primary.dark,
        ),
        cursor: "not-allowed",
      },

      '&[data-fullwidth="true"]': {
        width: "100%",
      },

      ...sizeVariants,
    },
  };
});
