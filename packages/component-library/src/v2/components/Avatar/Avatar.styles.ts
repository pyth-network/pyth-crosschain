import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-avatar", (theme) => {
  const withBorderRadius = { borderRadius: theme.tokens.borderRadius.full };
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
        theme.colors.highlight.light,
        theme.colors.highlight.dark,
      ),
      color: theme.colors.button.primary.foreground,
      display: "inline-flex",
      height: theme.spacing(10),
      justifyContent: "center",
      width: theme.spacing(10),
    },
  };
});
