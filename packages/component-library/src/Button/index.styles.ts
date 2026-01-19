import type { SimpleStyleRules } from "simplestyle-js";

import { createStyles } from "../styles";
import { BUTTON_SIZES, BUTTON_VARIANTS } from "./constants";

export const { classes } = createStyles("pyth-button", (theme) => {
  return {
    icon: {
      display: "grid",
    },
    text: {},

    buttonRoot: {
      alignItems: "center",
      border: "1px solid transparent",
      cursor: "pointer",
      display: "inline-flex",
      flexFlow: "row nowrap",
      fontWeight: theme.fontWeight.medium,
      justifyContent: "center",
      lineHeight: "normal",
      outline: `${theme.spacing(1)} solid transparent`,
      outlineOffset: "0",
      textDecoration: "none",
      textAlign: "center",
      transitionProperty:
        "background-color, color, border-color, outline-color",
      transitionDuration: "100ms",
      transitionTimingFunction: "linear",
      whiteSpace: "nowrap",
      "-webkit-tap-highlight-color": "transparent",
    },
  };
});
