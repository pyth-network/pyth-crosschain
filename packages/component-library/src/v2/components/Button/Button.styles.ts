import type { SimpleStyleRules } from "simplestyle-js/ssr";

import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-button", (theme) => {
  let buttonVariants: SimpleStyleRules["key"] = {};
  let sizeVariants: SimpleStyleRules["key"] = {};
  const resolveBackgroundColor = (
    background:
      | {
          active: { light: string; dark: string };
          hover: { light: string; dark: string };
        }
      | {
          active: { light: string; dark: string };
          hover: { light: string; dark: string };
          normal: { light: string; dark: string };
        }
      | { active: string; hover: string; normal: string },
    state: "active" | "hover" | "normal",
  ) => {
    if ("normal" in background) {
      return theme.resolveThemeColor(background[state]);
    }
    if (state === "hover") {
      return theme.resolveThemeColor(background.hover);
    }
    if (state === "active") {
      return theme.resolveThemeColor(background.active);
    }
    return theme.colors.transparent;
  };
  const mutedMixBase = theme.resolveThemeColor(theme.colors.background.primary);
  const muteColor = (color: string) =>
    color === theme.colors.transparent
      ? color
      : `color-mix(in srgb, ${color} 70%, ${mutedMixBase} 30%)`;
  const resolvedButtonVariants = {
    ghost: theme.colors.button.ghost,
    outline: theme.colors.button.outline,
    primary: theme.colors.button.primary,
    secondary: theme.colors.button.secondary,
  } as const;

  for (const [variant, rules] of Object.entries(resolvedButtonVariants)) {
    const borderValue =
      "border" in rules
        ? `1px solid ${theme.resolveThemeColor(rules.border)}`
        : "1px solid transparent";
    const normalBackground = resolveBackgroundColor(rules.background, "normal");
    const normalForeground = theme.resolveThemeColor(rules.foreground);
    const disabledBackground = muteColor(normalBackground);
    const disabledForeground = muteColor(normalForeground);
    buttonVariants = {
      ...buttonVariants,
      [`&[data-buttonvariant="${variant}"]`]: {
        backgroundColor: normalBackground,
        border: borderValue,
        color: normalForeground,
        transition:
          "background-color .2s ease, border .2s ease, color .2s ease",

        "&:hover": {
          backgroundColor: resolveBackgroundColor(rules.background, "hover"),
          color: theme.resolveThemeColor(rules.foreground),
        },

        "&:active": {
          backgroundColor: resolveBackgroundColor(rules.background, "active"),
        },

        '&:disabled, &[aria-disabled="true"]': {
          backgroundColor: disabledBackground,
          border: borderValue,
          color: disabledForeground,
        },
      },
    };
  }

  for (const [size, sizes] of Object.entries(theme.buttonSizes)) {
    sizeVariants = {
      ...sizeVariants,
      [`&[data-buttonsize="${size}"]`]: {
        borderRadius: sizes.borderRadius,
        fontSize: sizes.fontSize,
        gap: sizes.gap,
        height: sizes.height,
        padding: sizes.padding,

        "&[data-iconbutton]": {
          width: sizes.height,
        },
      },
    };
  }

  return {
    /**
     * icon displayed to the left or right of the button text
     */
    icon: {
      height: "1em",
      width: "auto",
    },

    /**
     * class name applied to a tooltip that wraps
     * around a button, if specified
     */
    tooltip: { ...theme.popoverTooltipStyles() },

    /**
     * root of the button
     */
    root: {
      alignItems: "center",
      border: "none",
      display: "inline-flex",
      fontSize: theme.tokens.fontSizes.base,
      justifyContent: "center",

      "&:hover": {
        cursor: "pointer",
      },

      '&:disabled, &[aria-disabled="true"]': {
        cursor: "not-allowed",
      },

      ...buttonVariants,
      ...sizeVariants,
    },
  };
});
