import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-checkbox", (theme) => ({
  wrapper: {
    display: "inline-flex",
  },
  root: {
    alignItems: "center",
    color: theme.resolveThemeColor(theme.colors.muted),
    cursor: "pointer",
    display: "inline-flex",
    gap: theme.spacing(1),
    justifyContent: "center",

    "& svg": {
      height: theme.tokens.fontSizes.xl,
      width: "auto",
    },

    "&[data-checked]": {
      borderColor: theme.resolveThemeColor(theme.colors.focus),
      color: theme.resolveThemeColor(theme.colors.foreground),
      '& [data-checkbox-icon="unchecked"]': {
        opacity: 0,
      },
      '& [data-checkbox-icon="checked"]': {
        opacity: 1,
      },
    },
    '& [data-checkbox-icon="unchecked"]': {
      opacity: 1,
    },
    '& [data-checkbox-icon="checked"]': {
      opacity: 0,
    },
    '&[data-compact="true"]': {
      borderRadius: theme.tokens.borderRadius.sm,
      padding: theme.spacing(1),
      width: theme.spacing(8),
      height: theme.spacing(8),
      gap: 0,
    },
    "&:focus-visible": {
      borderColor: theme.resolveThemeColor(theme.colors.focus),
      boxShadow: `0 0 0 3px ${theme.resolveThemeColor(theme.colors.focusDim)}`,
      outline: "none",
    },
  },
  iconSlot: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    height: theme.tokens.fontSizes.xl,
    width: theme.tokens.fontSizes.xl,
  },
  uncheckedIcon: {
    position: "absolute",
    inset: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    width: "100%",
  },
  checkedIndicator: {
    alignItems: "center",
    display: "inline-flex",
    inset: 0,
    justifyContent: "center",
    position: "absolute",
    height: "100%",
    width: "100%",
  },
  checkedIcon: {
    height: theme.tokens.fontSizes.xl,
    width: "auto",
  },
}));
