import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-left-nav", (theme) => ({
  /**
   * class name applied to the section that holds
   * a UI affordance to display the current user
   * and an additional actions menu on it
   */
  currentUser: {
    borderTop: `1px solid ${theme.lightDark(theme.palette.border.primary.light, theme.palette.border.primary.dark)}`,
    flexShrink: 0,
    padding: theme.spacing(4),
  },

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
    flexGrow: 1,
    overflowY: "auto",

    "& > a": {
      display: "flex",
    },
  },

  /**
   * top-most area that contains the PYTH logo
   */
  top: {
    borderBottom: `1px solid ${theme.lightDark(theme.palette.border.primary.light, theme.palette.border.primary.dark)}`,
    flexShrink: 0,
  },

  /**
   * root of the <nav />
   */
  root: {
    backgroundColor: theme.color.leftNav.background.primary,
    borderRight: `1px solid ${theme.lightDark(theme.palette.sidebarBorder.primary.light, theme.palette.sidebarBorder.primary.dark)}`,
    display: "flex",
    flexFlow: "column",
    height: "100%",
    minHeight: 0,
    width: theme.widths.leftNav.desktop,
  },
}));
