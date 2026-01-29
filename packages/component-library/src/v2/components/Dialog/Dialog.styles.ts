import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-dialog", (theme) => ({
  actions: {
    ...theme.flexRowCenter(theme.spacing(2)),
    justifyContent: "flex-end",
    marginTop: theme.spacing(5),
  },
  backdrop: {
    backgroundColor: theme.color.overlay.backdrop,
    inset: 0,
    position: "fixed",
  },
  close: {
    minWidth: theme.spacing(20),
  },
  description: {
    color: theme.color.dialog.description,
    fontSize: theme.fontSize.base,
    marginTop: theme.spacing(3),
  },
  popup: {
    ...theme.flexVertical(),
    backgroundColor: theme.color.dialog.background,
    border: `1px solid ${theme.color.dialog.border}`,
    borderRadius: theme.borderRadius.popover,
    boxShadow: theme.elevation.lg,
    color: theme.color.dialog.foreground,
    maxWidth: "min(600px, calc(100vw - 2.5rem))",
    padding: theme.spacing(6),
    width: "100%",
  },
  title: {
    color: theme.color.dialog.foreground,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: theme.letterSpacing.tight,
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
