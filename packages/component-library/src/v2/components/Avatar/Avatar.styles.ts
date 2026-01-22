import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-avatar", (theme) => ({
  root: {
    alignItems: "center",
    backgroundColor: theme.lightDark(
      theme.palette.primary.primary.light,
      theme.palette.primary.primary.dark,
    ),
    borderRadius: theme.borderRadius.lg,
    color: theme.lightDark(
      theme.palette.foreground.primary.dark,
      theme.palette.foreground.primary.light,
    ),
    display: "inline-flex",
    height: theme.heights.avatar,
    justifyContent: "center",
    width: theme.widths.avatar,
  },
}));
