import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-stat-card", (theme) => ({
  root: {
    backgroundColor: theme.lightDark(
      theme.palette.card.primary.light,
      theme.palette.card.primary.dark,
    ),
    borderRadius: theme.borderRadius["xl"],
    position: "relative",

    '&[data-variant="primary"]': {
      "& $header": {
        color: theme.lightDark(
          theme.palette.primary.primary.light,
          theme.palette.primary.primary.dark,
        ),
      },
    },
  },

  cardContents: {
    display: "flex",
    flexFlow: "column nowrap",
    justifyContent: "space-between",
    padding: theme.spacing(6),
    paddingBottom: theme.spacing(4),
    gap: theme.spacing(8),
    height: "100%",
    width: "100%",
  },

  top: {
    display: "flex",
    flexFlow: "column nowrap",
    justifyContent: "space-between",
    height: theme.spacing(30),
  },

  corner: {
    position: "absolute",
    right: theme.spacing(6),
    top: theme.spacing(6),
    display: "flex",
  },

  header: {
    color: theme.lightDark(
      theme.palette.mutedForeground.primary.light,
      theme.palette.mutedForeground.primary.dark,
    ),
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(4),
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    fontFamily: theme.fontFamily.normal,
    margin: 0,
  },

  dualHeader: {
    display: "flex",
    flexFlow: "row nowrap",
    justifyContent: "space-between",
    alignItems: "center",
  },

  stats: {
    display: "flex",
    flexFlow: "row nowrap",
    justifyContent: "space-between",
    alignItems: "center",

    '&[data-small="true"]': {
      "& $mainStat": {
        fontSize: theme.fontSize.lg,
      },
    },
  },

  stat: {
    display: "flex",
    flexFlow: "row nowrap",
    alignItems: "center",
    gap: theme.spacing(6),
  },

  mainStat: {
    fontSize: theme.fontSize["2xl"],
    fontWeight: theme.fontWeight.medium,
    fontFamily: theme.fontFamily.normal,
    letterSpacing: theme.letterSpacing.tighter,
    lineHeight: theme.spacing(16),
    height: theme.spacing(16),
    display: "flex",
    alignItems: "center",
    color: theme.lightDark(
      theme.palette.cardForeground.primary.light,
      theme.palette.cardForeground.primary.dark,
    ),
    flexGrow: 1,
    textAlign: "left",
  },

  miniStat: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    fontFamily: theme.fontFamily.normal,
  },

  bottom: {},
}));
