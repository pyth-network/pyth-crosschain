import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-left-nav-link", (theme) => {
  const foregroundColor = theme.resolveThemeColor(
    theme.colors.button.navlink.foreground.normal,
  );
  const activeBackgroundColor = theme.resolveThemeColor(
    theme.colors.button.navlink.background.active,
  );
  const hoverBackgroundColor = theme.resolveThemeColor(
    theme.colors.button.navlink.background.hover,
  );

  return {
    root: {
      '&[data-leftnavlink="true"]': {
        background: theme.resolveThemeColor(
          theme.colors.button.navlink.background.normal,
        ),
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
          borderColor: theme.resolveThemeColor(
            theme.colors.button.navlink.border.hover,
          ),
          color: "inherit",
        },

        '&[data-active="true"]': {
          backgroundColor: activeBackgroundColor,
          borderColor: theme.resolveThemeColor(
            theme.colors.button.navlink.border.active,
          ),
        },
        "&[data-disabled]": {
          backgroundColor: theme.resolveThemeColor(
            theme.colors.button.navlink.background.disabled,
          ),
          color: theme.resolveThemeColor(
            theme.colors.button.navlink.foreground.disabled,
          ),
          cursor: "not-allowed",
        },
      },
    },
  };
});
