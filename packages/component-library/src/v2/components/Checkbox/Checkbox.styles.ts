import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-checkbox", (theme) => ({
  wrapper: {
    display: "inline-flex",
  },
  root: {
    alignItems: "center",
    color: theme.lightDark(
      theme.palette.mutedForeground.primary.light,
      theme.palette.mutedForeground.primary.dark,
    ),
    cursor: "pointer",
    display: "inline-flex",
    gap: theme.spacing(1),
    justifyContent: "center",

    "& svg": {
      height: theme.fontSize.xl,
      width: "auto",
    },

    "&[data-checked]": {
      borderColor: theme.lightDark(
        theme.palette.ring.primary.light,
        theme.palette.ring.primary.dark,
      ),
      color: theme.lightDark(
        theme.palette.foreground.primary.light,
        theme.palette.foreground.primary.dark,
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
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing(1),
      width: theme.spacing(8),
      height: theme.spacing(8),
      gap: 0,
    },
    "&:focus-visible": {
      borderColor: theme.lightDark(
        theme.palette.ring.primary.light,
        theme.palette.ring.primary.dark,
      ),
      boxShadow: `0 0 0 3px ${theme.lightDark(
        theme.palette.ring.primary.light,
        theme.palette.ring.primary.dark,
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
    height: theme.fontSize.xl,
    width: theme.fontSize.xl,
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
    height: theme.fontSize.xl,
    width: "auto",
  },
}));
