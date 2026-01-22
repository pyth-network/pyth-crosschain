import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-select", (theme) => {
  const borderColor = theme.lightDark(
    theme.palette.border.primary.light,
    theme.palette.border.primary.dark,
  );

  const borderColorHover = theme.lightDark(
    theme.blendColor(theme.palette.border.primary.light, "black", 0.3),
    theme.blendColor(theme.palette.border.primary.dark, "white", 0.3),
  );

  const borderColorFocus = theme.lightDark(
    theme.palette.ring.primary.light,
    theme.palette.ring.primary.dark,
  );

  const backgroundColor = theme.lightDark(
    theme.palette.inputBackground.primary.light,
    theme.palette.inputBackground.primary.dark,
  );

  const foregroundColor = theme.lightDark(
    theme.palette.foreground.primary.light,
    theme.palette.foreground.primary.dark,
  );

  const mutedForeground = theme.lightDark(
    theme.palette.mutedForeground.primary.light,
    theme.palette.mutedForeground.primary.dark,
  );

  const popoverBackground = theme.lightDark(
    theme.palette.popover.primary.light,
    theme.palette.popover.primary.dark,
  );

  const highlightBackground = theme.lightDark(
    theme.blendColor(theme.palette.muted.primary.light, "black", 0.05),
    theme.blendColor(theme.palette.muted.primary.dark, "white", 0.1),
  );

  return {
    trigger: {
      alignItems: "center",
      backgroundColor,
      border: `1px solid ${borderColor}`,
      borderRadius: theme.borderRadius.md,
      color: foregroundColor,
      cursor: "pointer",
      display: "inline-flex",
      fontFamily: theme.fontFamily.normal,
      fontSize: theme.fontSize.base,
      gap: theme.spacing(2),
      justifyContent: "space-between",
      minWidth: "120px",
      outline: `${theme.spacing(1)} solid transparent`,
      outlineOffset: 0,
      padding: theme.spacing(2),
      transition:
        "border-color 100ms linear, outline-color 100ms linear, background-color 100ms linear",

      "&:hover": {
        borderColor: borderColorHover,
      },

      "&:focus, &[data-popup-open]": {
        borderColor: borderColorFocus,
        outlineColor: theme.lightDark(
          theme.blendColor(theme.palette.ring.primary.light, "white", 0.5),
          theme.blendColor(theme.palette.ring.primary.dark, "black", 0.5),
        ),
      },

      "&:disabled, &[data-disabled]": {
        backgroundColor: theme.lightDark(
          theme.palette.muted.primary.light,
          theme.palette.muted.primary.dark,
        ),
        borderColor: "transparent",
        color: mutedForeground,
        cursor: "not-allowed",
      },

      '&[data-fullwidth="true"]': {
        width: "100%",
      },
    },

    value: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",

      "&[data-placeholder]": {
        color: mutedForeground,
      },
    },

    icon: {
      color: mutedForeground,
      flexShrink: 0,
      height: "1em",
      transition: "transform 150ms ease",
      width: "1em",

      "[data-popup-open] &": {
        transform: "rotate(180deg)",
      },
    },

    positioner: {
      outline: "none",
      zIndex: 1000,
    },

    popup: {
      backgroundColor: popoverBackground,
      border: `1px solid ${borderColor}`,
      borderRadius: theme.borderRadius.md,
      boxShadow:
        "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      maxHeight: "min(var(--available-height), 300px)",
      minWidth: "var(--anchor-width)",
      outline: "none",
      overflow: "hidden",

      "&[data-starting-style], &[data-ending-style]": {
        opacity: 0,
        transform: "scale(0.95)",
      },
    },

    list: {
      outline: "none",
      overflow: "auto",
      padding: theme.spacing(1),
    },

    item: {
      alignItems: "center",
      borderRadius: theme.borderRadius.sm,
      color: foregroundColor,
      cursor: "pointer",
      display: "flex",
      fontFamily: theme.fontFamily.normal,
      fontSize: theme.fontSize.base,
      gap: theme.spacing(2),
      outline: "none",
      padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
      transition: "background-color 100ms ease",
      userSelect: "none",

      "&[data-highlighted]": {
        backgroundColor: highlightBackground,
      },

      "&[data-selected]": {
        fontWeight: theme.fontWeight.medium,
      },

      "&[data-disabled]": {
        color: mutedForeground,
        cursor: "not-allowed",
      },
    },

    itemIndicator: {
      alignItems: "center",
      color: borderColorFocus,
      display: "inline-flex",
      flexShrink: 0,
      height: "1em",
      justifyContent: "center",
      width: "1em",
    },

    itemText: {
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },

    scrollArrow: {
      alignItems: "center",
      color: mutedForeground,
      cursor: "default",
      display: "flex",
      height: theme.spacing(6),
      justifyContent: "center",
    },

    group: {
      "&:not(:first-child)": {
        marginTop: theme.spacing(2),
      },
    },

    groupLabel: {
      color: mutedForeground,
      fontSize: theme.fontSize.xs,
      fontWeight: theme.fontWeight.medium,
      letterSpacing: theme.letterSpacing.wide,
      padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
      textTransform: "uppercase",
    },

    separator: {
      backgroundColor: borderColor,
      height: "1px",
      margin: `${theme.spacing(1)} 0`,
    },
  };
});
