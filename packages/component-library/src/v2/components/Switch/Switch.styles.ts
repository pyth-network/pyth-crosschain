import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-switch", (theme) => {
  const thumbSize = theme.spacing(5);
  const switchWidth = theme.spacing(12);

  return {
    /**
     * class name applied to the root <label />
     * around the switch component
     */
    root: {
      '& [role="switch"]': {
        "&:hover": {
          backgroundColor: theme.resolveThemeColor(
            theme.colors.background.cardHighlight,
          ),
        },
        '&[aria-checked="false"]': {
          "& $thumb": {
            "& > span": {
              "&:first-child": {
                color: theme.lightDark(
                  theme.colors.foreground.dark,
                  theme.colors.foreground.light,
                ),
                opacity: 1,
              },
              "&:last-child": {
                opacity: 0,
              },
            },
          },
        },

        '&[aria-checked="true"]': {
          "& $thumb": {
            "& > span": {
              "&:first-child": {
                opacity: 0,
              },
              "&:last-child": {
                color: theme.lightDark(
                  theme.colors.foreground.dark,
                  theme.colors.foreground.light,
                ),
                opacity: 1,
              },
            },
            left: `calc(${switchWidth} - ${thumbSize} - ${theme.spacing(1)})`,
          },
        },
        alignItems: "center",
        backgroundColor: theme.resolveThemeColor(
          theme.colors.background.secondary,
        ),
        borderRadius: theme.tokens.borderRadius.xl2,
        display: "inline-flex",
        justifyContent: "space-between",
        padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
        position: "relative",
        transition: "background-color .2s ease",
        width: theme.spacing(12),
      },

      "& svg": {
        color: "currentColor",
        display: "block",
        height: "1em",
        width: "auto",
      },

      "&:hover": {
        cursor: "pointer",
      },

      '&[data-variant="icon"] [role="switch"]': {
        "& $thumb": {
          top: theme.spacing(0.5),
        },
        height: `calc(${thumbSize} + ${theme.spacing(1)})`,
      },

      '&[data-variant="normal"] [role="switch"]': {
        "& $thumb": {
          top: theme.spacing(0.5),
        },
        height: `calc(${thumbSize} + ${theme.spacing(1)})`,
      },
      display: "inline-block",
    },
    switch: {},

    /**
     * css class name applied to the ball of the switch
     */
    thumb: {
      "& > span": {
        alignItems: "center",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        lineHeight: 0,
        opacity: 0,
        position: "absolute",
        transition: "color .2s ease, opacity .2s ease",
      },
      alignItems: "center",
      backgroundColor: theme.palette.black,
      borderRadius: theme.tokens.borderRadius.full,
      display: "flex",
      height: thumbSize,
      justifyContent: "center",
      left: theme.spacing(1),
      position: "absolute",
      top: 0,
      transition: "left .2s ease",
      width: thumbSize,
    },
  };
});
