import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-left-nav", (theme) => ({
  /**
   * class name that applies to the actions menu popover
   * that is displayed when a user clicks on the ellipsis near their
   * name
   */
  actionsMenuPopover: {
    width: `calc(${theme.widths.leftNav.desktop} - ${theme.spacing(2)})`,
  },

  /**
   * class name applied to the vertical ellipsis trigger
   * that opens the user actions menu
   */
  actionsMenuTriggerIcon: {
    background: "transparent",
    border: "none",
    borderRadius: theme.borderRadius.lg,
    height: theme.spacing(6),
    outline: "none",
    padding: 0,
    transition: "background-color .2s ease, color .2s ease",
    width: "auto",
  },

  /**
   * class name applied to the section that holds
   * a UI affordance to display the current user
   * and an additional actions menu on it
   */
  currentUser: {
    borderTop: `1px solid ${theme.lightDark(theme.palette.border.primary.light, theme.palette.border.primary.dark)}`,
    display: "inline-grid",
    flexShrink: 0,
    gap: theme.spacing(2),
    gridTemplateColumns: "auto 1fr",
    minWidth: 0,
    padding: theme.spacing(4),
  },

  /**
   * class name applied to the additional set of user information
   * displayed next to the user's avatar
   */
  currentUserDetails: {
    alignItems: "flex-start",
    display: "inline-flex",
    flexFlow: "column",
    fontSize: theme.fontSize.base,
    gap: theme.spacing(1),
    minWidth: 0,
    width: "100%",

    "& > span": {
      display: "block",
      maxWidth: "100%",
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      "&:last-child": {
        color: theme.lightDark(
          theme.palette.mutedForeground.primary.light,
          theme.palette.mutedForeground.primary.dark,
        ),
        fontSize: theme.fontSize.sm,
      },
    },
  },

  /**
   * simple <div /> wrapping around the <svg /> of the Pyth logo
   */
  logoWrapper: {
    padding: theme.spacing(4),

    "& > svg": {
      height: theme.fontSize.base,
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

    '&[data-hasactionsmenu="true"]': {
      "& $currentUser": {
        gridTemplateColumns: "auto 1fr auto",

        "& > $currentUserDetails": {},
      },
    },
  },
}));
