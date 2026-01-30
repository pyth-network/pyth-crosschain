import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-left-nav", (theme) => {
  const leftNavDesktopWidth = theme.spacing(72);
  const leftNavCollapsedWidth = theme.spacing(16);
  return {
    /**
     * class name that applies to the actions menu popover
     * that is displayed when a user clicks on the ellipsis near their
     * name
     */
    actionsMenuPopover: {
      width: `calc(${leftNavDesktopWidth} - ${theme.spacing(2)})`,
    },

    /**
     * class name applied specifically to the trigger
     * that opens the actions menu
     */
    actionsMenuTrigger: {
      flexShrink: 0,
    },

    /**
     * class name applied to the vertical ellipsis trigger
     * that opens the user actions menu
     */
    actionsMenuTriggerIcon: {
      background: "transparent",
      border: "none",
      borderRadius: theme.tokens.borderRadius.lg,
      height: theme.spacing(6),
      outline: "none",
      padding: 0,
      transition: "background-color .2s ease, color .2s ease",
      width: "auto",
    },

    /**
     * class name applied to the <span /> that wraps around the vertical ellipsis
     */
    ellipsis: {},

    /**
     * class name applied to the section that holds
     * a UI affordance to display the current user
     * and an additional actions menu on it
     */
    currentUser: {
      "&[data-currentusermenu]": {
        borderRadius: 0,
        borderTop: `1px solid ${theme.resolveThemeColor(theme.colors.border)}`,
        display: "inline-grid",
        flexShrink: 0,
        gap: theme.spacing(2),
        gridTemplateColumns: "auto 1fr",
        height: "100%",
        minWidth: 0,
        width: "100%",
      },
    },

    /**
     * class name applied to the additional set of user information
     * displayed next to the user's avatar
     */
    currentUserDetails: {
      alignItems: "flex-start",
      display: "inline-flex",
      flexFlow: "column",
      fontSize: theme.tokens.fontSizes.base,
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
          color: theme.resolveThemeColor(theme.colors.muted),
          fontSize: theme.tokens.fontSizes.sm,
        },
      },
    },

    /**
     * simple <div /> wrapping around the <svg /> of the Pyth logo
     */
    logoWrapper: {
      alignItems: "center",
      display: "flex",
      gap: theme.spacing(2),
      justifyContent: "space-between",
      padding: theme.spacing(4),

      "& > button": {
        marginRight: `calc(${theme.spacing(2)} * -1)`,
      },

      "& > svg": {
        height: theme.tokens.fontSizes.base,
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
      backgroundColor: theme.resolveThemeColor(
        theme.colors.background.secondary,
      ),
      borderRight: `1px solid ${theme.resolveThemeColor(theme.colors.border)}`,
      display: "flex",
      flexFlow: "column",
      height: "100vh",
      minHeight: 0,
      width: leftNavDesktopWidth,

      '&[data-open="false"]': {
        width: leftNavCollapsedWidth,

        "& $logoWrapper": {
          display: "flex",
          justifyContent: "center",

          "& > button": {
            marginRight: "unset",
          },
        },

        "& $navLinks": {
          '& [data-leftnavlink="true"]': {
            fontSize: 0,
            gap: 0,
            justifyContent: "center",
            overflow: "hidden",
            padding: theme.spacing(2),
            whiteSpace: "nowrap",

            "& > svg": {
              height: theme.spacing(5),
              width: "auto",
            },
          },
        },

        "& $currentUser": {
          gridTemplateColumns: "auto",
          justifyItems: "center",
          padding: theme.spacing(3),
        },

        "& $currentUserDetails": {
          display: "none",
        },
      },

      '&[data-hasactionsmenu="true"]': {
        "& $currentUser": {
          gridTemplateColumns: "auto 1fr auto",

          "& > $currentUserDetails": {},
        },
      },

      '&[data-open="false"][data-hasactionsmenu="true"]': {
        "& $currentUser": {
          gridTemplateColumns: "auto",
          "& $ellipsis": {
            display: "none",
          },
        },
      },
    },
  };
});
