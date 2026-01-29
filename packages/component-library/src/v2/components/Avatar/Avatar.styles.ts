import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-avatar", (theme) => {
  const withBorderRadius = { borderRadius: theme.borderRadius.lg };
  return {
    img: {
      ...withBorderRadius,
      height: "100%",
      objectFit: "contain",
      width: "100%",
    },

    root: {
      ...withBorderRadius,
      alignItems: "center",
      backgroundColor: theme.lightDark(
        theme.palette.primary.primary.light,
        theme.palette.primary.primary.dark,
      ),
      color: theme.lightDark(
        theme.palette.foreground.primary.dark,
        theme.palette.foreground.primary.light,
      ),
      display: "inline-flex",
      height: theme.heights.avatar,
      justifyContent: "center",
      width: theme.widths.avatar,
    },
  };
});
