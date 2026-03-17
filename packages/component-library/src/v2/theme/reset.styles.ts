import { createImports, createRawStyles } from "./style-funcs";

createImports("pyth-v2-imports", () => [
  '@import "modern-normalize/modern-normalize.css"',
  '@import "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"',
]);

createRawStyles("v2-additional-reset", (theme) => ({
  "*::selection": {
    background: theme.resolveThemeColor(theme.colors.selection.background),
    color: theme.resolveThemeColor(theme.colors.selection.foreground),
  },
  body: {
    "-moz-osx-font-smoothing": "grayscale",
    "-webkit-font-smoothing": "antialiased",
    background: theme.resolveThemeColor(theme.colors.background.primary),
    color: theme.resolveThemeColor(theme.colors.foreground),
    lineHeight: 1,
    scrollBehavior: "smooth",
  },

  "body, html": {
    fontFamily: theme.tokens.fontFamilies.normal,
  },
}));
