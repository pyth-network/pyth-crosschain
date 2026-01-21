import { createStyles } from "../../styles";

export const { classes } = createStyles("pyth-app-layout", (theme) => ({
  /**
   * <main /> element that holds the right-side content
   */
  main: {
    height: "100%",
    overflowY: "auto",
  },
  /**
   * root of the pyth app layout
   */
  root: {
    bottom: 0,
    display: "grid",
    gridTemplateColumns: `${theme.widths.leftNav.desktop} 1fr`,
    left: 0,
    position: "fixed",
    right: 0,
    top: 0,
  },
}));
