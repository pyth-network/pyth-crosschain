import { createImports, createRawStyles } from "./style-funcs";

createImports("pyth-v2-imports", () => [
  '@import "modern-normalize/modern-normalize.css"',
  '@import "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"',
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

  "body, html": {
    fontFamily: theme.tokens.fontFamilies.normal,
  },

  "*::selection": {
    background: theme.resolveThemeColor(theme.colors.selection.background),
    color: theme.resolveThemeColor(theme.colors.selection.foreground),
  },
}));
