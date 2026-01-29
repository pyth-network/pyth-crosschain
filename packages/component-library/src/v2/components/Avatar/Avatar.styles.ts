import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-avatar", (theme) => {
  const withBorderRadius = { borderRadius: theme.borderRadius.avatar };
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
        theme.palette.brandPythPrimary.light,
        theme.palette.brandPythPrimary.dark,
      ),
      color: theme.lightDark(
        theme.palette.card.light,
        theme.palette.foreground.dark,
      ),
      display: "inline-flex",
      height: theme.heights.avatar,
      justifyContent: "center",
      width: theme.widths.avatar,
    },
  };
});
