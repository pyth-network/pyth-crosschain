import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-left-nav", (theme) => ({
  /**
   * simple <div /> wrapping around the <svg /> of the Pyth logo
   */
  logoWrapper: {
    padding: theme.spacing(4),

    "& > svg": {
      height: theme.fontSize.lg,
      width: "auto",
    },
  },

  /**
   * container around all the nav links in the left panel
   */
  navLinks: {
    "& > a": {
      display: "flex",
    },
  },

  /**
   * top-most area that contains the PYTH logo
   */
  top: {
    borderBottom: `1px solid ${theme.lightDark(theme.palette.border.primary.light, theme.palette.border.primary.dark)}`,
  },

  /**
   * root of the <nav />
   */
  root: {
    backgroundColor: theme.color.leftNav.background.primary,
    borderRight: `1px solid ${theme.lightDark(theme.palette.sidebarBorder.primary.light, theme.palette.sidebarBorder.primary.dark)}`,
    height: "100%",
    width: theme.widths.leftNav.desktop,
  },
}));
