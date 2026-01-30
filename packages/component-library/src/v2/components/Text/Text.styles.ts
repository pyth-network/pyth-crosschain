import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const textColorTokens = [
  "foreground",
  "muted",
  "paragraph",
  "heading",
  "highlight",
  "tooltip",
  "link",
  "linkPrimary",
  "stateData",
  "stateError",
  "stateInfo",
  "stateSuccess",
  "stateWarning",
] as const;

export type TextColorToken = (typeof textColorTokens)[number];

export const { classes } = createStyles("v2-text-component", (theme) => {
  const getTextColorValue = (token: TextColorToken) => {
    switch (token) {
      case "foreground": {
        return theme.colors.foreground;
      }
      case "muted": {
        return theme.colors.muted;
      }
      case "paragraph": {
        return theme.colors.paragraph;
      }
      case "heading": {
        return theme.colors.heading;
      }
      case "highlight": {
        return theme.colors.highlight;
      }
      case "tooltip": {
        return theme.colors.tooltip;
      }
      case "link": {
        return theme.colors.link.normal;
      }
      case "linkPrimary": {
        return theme.colors.link.primary;
      }
      case "stateData": {
        return theme.colors.states.data.normal;
      }
      case "stateError": {
        return theme.colors.states.error.normal;
      }
      case "stateInfo": {
        return theme.colors.states.info.normal;
      }
      case "stateSuccess": {
        return theme.colors.states.success.normal;
      }
      case "stateWarning": {
        return theme.colors.states.warning.normal;
      }
      default: {
        return theme.colors.foreground;
      }
    }
  };
  const resolveTextColor = (token: TextColorToken) => {
    const value = getTextColorValue(token);
    if (typeof value === "string") {
      return value;
    }
    return theme.resolveThemeColor(value);
  };
  let colorVariants: SimpleStyleRules["key"] = {};
  for (const colorName of textColorTokens) {
    colorVariants = {
      ...colorVariants,
      [`&[data-color="${colorName}"]`]: {
        color: resolveTextColor(colorName),
      },
    };
  }

  let boldVariants: SimpleStyleRules["key"] = {};

  for (const [boldName, boldVal] of Object.entries(theme.tokens.fontWeights)) {
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
