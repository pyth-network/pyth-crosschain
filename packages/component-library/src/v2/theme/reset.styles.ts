import { createImports, createRawStyles } from "./style-funcs";

createImports("pyth-v2-imports", () => [
  '@import "modern-normalize/modern-normalize.css"',
]);

createRawStyles("v2-additional-reset", (theme) => ({
  body: {
    background: "black",
    "-webkit-font-smoothing": "antialiased",
    "-moz-osx-font-smoothing": "grayscale",
    scrollbehavior: "smooth",
    lineHeight: 1,
  },

  "*::selection": {
    background: theme.lightDark(
      theme.colors.selection.background.light,
      theme.colors.selection.background.dark,
    ),
    color: theme.lightDark(
      theme.colors.selection.foreground.light,
      theme.colors.selection.foreground.dark,
    ),
  },
}));
