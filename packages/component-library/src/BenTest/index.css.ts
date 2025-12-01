import { style } from "@vanilla-extract/css";

export const root = style({
  backgroundColor: "pink",
  color: "yellow",
});

export const h1 = style({
  fontStyle: "italic",
  selectors: {
    [`${root} > &`]: {
      fontSize: "4rem",
    },
  },
});
