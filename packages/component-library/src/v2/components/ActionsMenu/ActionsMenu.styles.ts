import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-actions-menu", (theme) => {
  const triggerHover = {
    backgroundColor: theme.resolveThemeColor(
      theme.colors.button.outline.background.hover,
    ),
    cursor: "pointer",
  };

  return {
    /**
     * class name applied to each individual menu item
     */
    menuItem: {
      alignItems: "center",
      display: "flex",
      gap: theme.spacing(2),
      padding: theme.spacing(2),
      transition: "background-color .2s ease, color .2s ease",

      "&:hover": triggerHover,
    },

    /**
     * class name applied to the menu popover that
     * holds all of the menu items
     */
    menuPopover: {
      ...theme.popoverTooltipStyles(),
    },

    /**
     * class name applied to the friendly title
     * that appears at the top of the menu popover
     */
    menuPopoverTitle: {
      color: theme.resolveThemeColor(theme.colors.muted),
      fontSize: theme.tokens.fontSizes.xs,
      padding: theme.spacing(2),
      textTransform: "uppercase",
    },

    /**
     * class name applied to the <div /> that wraps around a
     * user's content that will act as a trigger
     */
    trigger: {
      display: "inline-block",
    },
  };
});
