import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-dialog", (theme) => ({
  actions: {
    alignItems: "center",
    display: "flex",
    gap: theme.spacing(2),
    justifyContent: "flex-end",
    marginTop: theme.spacing(5),
  },
  backdrop: {
    backgroundColor: theme.lightDark(
      "rgba(0, 0, 0, 0.4)",
      "rgba(0, 0, 0, 0.6)",
    ),
    inset: 0,
    position: "fixed",
  },
  close: {
    minWidth: theme.spacing(20),
  },
  description: {
    color: theme.lightDark(
      theme.colors.paragraph.light,
      theme.colors.paragraph.dark,
    ),
    fontSize: theme.tokens.fontSizes.base,
    marginTop: theme.spacing(3),
  },
  popup: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: theme.lightDark(
      theme.colors.background.modal.light,
      theme.colors.background.modal.dark,
    ),
    border: `1px solid ${theme.lightDark(
      theme.colors.border.light,
      theme.colors.border.dark,
    )}`,
    borderRadius: theme.tokens.borderRadius.xxl,
    boxShadow: theme.elevations.default[2],
    color: theme.lightDark(
      theme.colors.foreground.light,
      theme.colors.foreground.dark,
    ),
    maxWidth: "min(600px, calc(100vw - 2.5rem))",
    padding: theme.spacing(6),
    width: "100%",
  },
  title: {
    color: theme.lightDark(
      theme.colors.foreground.light,
      theme.colors.foreground.dark,
    ),
    fontSize: theme.tokens.fontSizes.xl,
    fontWeight: theme.tokens.fontWeights.semibold,
    letterSpacing: theme.tokens.letterSpacing.tight,
  },
  viewport: {
    alignItems: "center",
    display: "flex",
    inset: 0,
    justifyContent: "center",
    padding: theme.spacing(6),
    position: "fixed",
    zIndex: 50,
  },
  root: {},
}));
