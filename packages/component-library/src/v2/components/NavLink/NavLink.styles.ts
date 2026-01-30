import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-left-nav-link", (theme) => {
  const foregroundColor = theme.lightDark(
    theme.colors.foreground.light,
    theme.colors.foreground.dark,
  );
  const activeBackgroundColor = theme.lightDark(
    theme.colors.button.outline.background.active.light,
    theme.colors.button.outline.background.active.dark,
  );
  // TODO: This is likely not right, but we'll investigate later
  const activeForegroundColor = theme.lightDark(
    theme.colors.foreground.light,
    theme.colors.foreground.dark,
  );
  const hoverBackgroundColor = theme.lightDark(
    theme.colors.button.outline.background.hover.light,
    theme.colors.button.outline.background.hover.dark,
  );

  return {
    root: {
      '&[data-leftnavlink="true"]': {
        background: "transparent",
        color: foregroundColor,
        justifyContent: "flex-start",
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(2),
        marginTop: theme.spacing(2),
        paddingLeft: theme.spacing(2),
        paddingRight: theme.spacing(2),
        outline: "none",
        textDecoration: "none",

        "&:hover": {
          // we flip the colors so the contrast works when we go to the dark theme
          backgroundColor: hoverBackgroundColor,
          color: "inherit",
        },

        '&[data-active="true"]': {
          backgroundColor: activeBackgroundColor,
          color: activeForegroundColor,
        },
      },
    },
  };
});
