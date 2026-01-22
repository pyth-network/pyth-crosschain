import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("pyth-v2-table-grid", (theme) => ({
  tableGrid: {
    "--ag-browser-color-scheme": "light-dark(light, dark)",
    "--ag-background-color": theme.color.background.primary,
    "--ag-header-background-color": "var(--ag-background-color)",
    "--ag-foreground-color": theme.palette.foreground.primary.light,
    "--ag-accent-color": theme.palette.primary.primary.light,
    "--ag-header-font-size": theme.fontSize.xs,
    "--ag-header-font-weight": theme.fontWeight.medium.toString(),
    "--ag-cell-font-size": theme.fontSize.xs,
    "--ag-wrapper-border": "none",
    "--ag-cell-text-color": theme.lightDark(
      theme.palette.foreground.primary.light,
      theme.palette.foreground.primary.dark,
    ),
    "--ag-data-font-size": theme.fontSize.base,
    height: "100%",
  },

  defaultCellContainer: {
    alignItems: "center",
    display: "flex",
    height: "100%",
  },

  skeletonContainer: {
    height: theme.spacing(10),
    width: "100%",
  },

  skeleton: {
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    backgroundColor: theme.lightDark(
      theme.palette.muted.primary.light,
      theme.palette.muted.primary.dark,
    ),
    borderRadius: theme.borderRadius.md,
    height: "100%",
    width: "100%",

    "@keyframes pulse": {
      "0%, 100%": { opacity: 1 },
      "50%": { opacity: 0.5 },
    },
  },
}));
