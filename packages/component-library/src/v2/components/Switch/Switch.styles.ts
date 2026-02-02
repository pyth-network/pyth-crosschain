import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-switch", (theme) => {
  const thumbSize = theme.spacing(5);
  const switchWidth = theme.spacing(12);

  return {
    switch: {},

    /**
     * css class name applied to the ball of the switch
     */
    thumb: {
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
    },

    /**
     * class name applied to the root <label />
     * around the switch component
     */
    root: {
      display: "inline-block",

      "&:hover": {
        cursor: "pointer",
      },

      "& svg": {
        color: "currentColor",
        display: "block",
        height: "1em",
        width: "auto",
      },

      '&[data-variant="normal"] [role="switch"]': {
        height: `calc(${thumbSize} + ${theme.spacing(1)})`,

        "& $thumb": {
          top: theme.spacing(0.5),
        },
      },

      '&[data-variant="icon"] [role="switch"]': {
        height: `calc(${thumbSize} + ${theme.spacing(1)})`,

        "& $thumb": {
          top: theme.spacing(0.5),
        },
      },

      '& [role="switch"]': {
        alignItems: "center",
        backgroundColor: theme.resolveThemeColor(
          theme.colors.background.secondary,
        ),
        borderRadius: theme.tokens.borderRadius.xxl,
        display: "inline-flex",
        justifyContent: "space-between",
        padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
        position: "relative",
        transition: "background-color .2s ease",
        width: theme.spacing(12),

        "&:hover": {
          backgroundColor: theme.resolveThemeColor(
            theme.colors.background.cardHighlight,
          ),
        },

        '&[aria-checked="true"]': {
          "& $thumb": {
            left: `calc(${switchWidth} - ${thumbSize} - ${theme.spacing(1)})`,

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
          },
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
      },
    },
  };
});
