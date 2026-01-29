import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-left-nav-link", (theme) => {
  const foregroundColor = theme.lightDark(
    theme.palette.foreground.light,
    theme.palette.foreground.dark,
  );
  const activeBackgroundColor = theme.lightDark(
    theme.palette.statePressed.light,
    theme.palette.statePressed.dark,
  );
  // TODO: This is likely not right, but we'll investigate later
  const activeForegroundColor = theme.lightDark(
    theme.palette.foreground.light,
    theme.palette.foreground.dark,
  );
  const hoverBackgroundColor = theme.lightDark(
    theme.palette.stateHover.light,
    theme.palette.stateHover.dark,
  );

  return {
    root: {
      '&[data-leftnavlink="true"]': {
        background: "transparent",
        color: foregroundColor,
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
