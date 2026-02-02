import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createKeyframes, createStyles } from "../../theme/style-funcs";

const { keyframe: rotation } = createKeyframes("v2-spinner-rotation", () => ({
  "0%": {
    transform: "rotate(0deg)",
  },
  "100%": {
    transform: "rotate(360deg)",
  },
}));

const { keyframe: rotationback } = createKeyframes(
  "v2-spinner-rotation-back",
  () => ({
    "0%": {
      transform: "rotate(0deg)",
    },
    "100%": {
      transform: "rotate(-360deg)",
    },
  }),
);

export const { classes } = createStyles("v2-spinner", (theme) => {
  const spinnerColor = theme.resolveThemeColor(theme.colors.highlight);
  const spinnerNegativeColor = theme.lightDark(
    theme.colors.background.primary.dark,
    theme.colors.background.primary.light,
  );

  let sizeVariants: SimpleStyleRules["key"] = {};

  for (const [size, rules] of Object.entries(theme.spinnerSizes)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-size="${size}"]`]: {
        fontSize: rules.fontSize,

        "& > $spinner": {
          borderWidth: rules.borderWidth,
          height: rules.height,
          width: rules.height,

          "&:after": {
            borderWidth: rules.borderWidth,
            height: `calc(${rules.height} * 0.7)`, // always scale the inner circle relative to the outer
            width: `calc(${rules.height} * 0.7)`,
          },
        },
      },
    };
  }

  return {
    label: {
      color: theme.resolveThemeColor(theme.colors.muted),
    },

    root: {
      ...sizeVariants,
      alignItems: "center",
      display: "inline-flex",
      flexDirection: "column",
      gap: theme.spacing(1),
      justifyContent: "center",
    },

    spinner: {
      animation: `${rotation} 1s linear infinite`,
      backfaceVisibility: "hidden",
      border: `4px solid`,
      borderColor: `${spinnerNegativeColor} ${spinnerNegativeColor} transparent`,
      borderRadius: "50%",
      boxSizing: "border-box",
      display: "inline-block",
      position: "relative",
      transform: "translateZ(0)",

      "&:after": {
        animation: `${rotationback} 0.5s linear infinite`,
        backfaceVisibility: "hidden",
        borderColor: `transparent ${spinnerColor} ${spinnerColor}`,
        borderRadius: "50%",
        borderStyle: "solid",
        bottom: 0,
        boxSizing: "border-box",
        content: '""',
        left: 0,
        margin: "auto",
        position: "absolute",
        right: 0,
        top: 0,
        transform: "translateZ(0)",
        transformOrigin: "center center",
      },
    },
  };
});
