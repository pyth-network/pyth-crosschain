import { createImports, createRawStyles } from "./style-funcs";

createImports("pyth-v2-imports", () => [
  '@import "modern-normalize/modern-normalize.css"',
]);

createRawStyles("v2-additional-reset", (theme) => ({
  body: {
    background: "black",
    "-webkit-font-smoothing": "antialiased",
    "-moz-osx-font-smoothing": "grayscale",
    color: theme.resolveThemeColor(theme.colors.foreground),
    scrollbehavior: "smooth",
    lineHeight: 1,
  },

  "*::selection": {
    background: theme.resolveThemeColor(theme.colors.selection.background),
    color: theme.resolveThemeColor(theme.colors.selection.foreground),
  },
}));
