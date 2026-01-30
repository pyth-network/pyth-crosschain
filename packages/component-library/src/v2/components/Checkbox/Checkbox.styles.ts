import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-checkbox", (theme) => ({
  wrapper: {
    display: "inline-flex",
  },
  root: {
    alignItems: "center",
    color: theme.lightDark(
      theme.colors.muted.light,
      theme.colors.muted.dark,
    ),
    cursor: "pointer",
    display: "inline-flex",
    gap: theme.spacing(1),
    justifyContent: "center",

    "& svg": {
      height: theme.tokens.fontSizes.xl,
      width: "auto",
    },

    "&[data-checked]": {
      borderColor: theme.lightDark(
        theme.colors.focus.light,
        theme.colors.focus.dark,
      ),
      color: theme.lightDark(
        theme.colors.foreground.light,
        theme.colors.foreground.dark,
      ),
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
      borderColor: theme.lightDark(
        theme.colors.focus.light,
        theme.colors.focus.dark,
      ),
      boxShadow: `0 0 0 3px ${theme.lightDark(
        theme.colors.focusDim.light,
        theme.colors.focusDim.dark,
      )}`,
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
