import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-actions-menu", (theme) => ({
  /**
   * class name applied to each individual menu item
   */
  menuItem: {
    alignItems: "center",
    display: "flex",
    gap: theme.spacing(2),
    padding: `${theme.spacing(2)} 0`,
  },

  /**
   * class name applied to the menu popover that
   * holds all of the menu items
   */
  menuPopover: {
    backgroundColor: theme.lightDark(
      theme.palette.popover.primary.light,
      theme.palette.popover.primary.dark,
    ),
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.elevation.md,
    padding: theme.spacing(2),
  },

  /**
   * class name applied to the friendly title
   * that appears at the top of the menu popover
   */
  menuPopoverTitle: {
    color: theme.lightDark(
      theme.palette.mutedForeground.primary.light,
      theme.palette.mutedForeground.primary.dark,
    ),
    fontSize: theme.fontSize.xs,
    padding: `${theme.spacing(2)} 0`,
    textTransform: "uppercase",
  },

  /**
   * class name applied to the vertical ellipsis trigger
   * that opens the user actions menu
   */
  trigger: {
    background: "none transparent",
    border: "none",
    borderRadius: theme.borderRadius.lg,
    outline: "none",
    padding: 0,
    transition: "background-color .2s ease, color .2s ease",

    "&:hover": {
      backgroundColor: theme.color.button.ghost.background.hover,
      cursor: "pointer",
    },
  },
}));
