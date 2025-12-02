import { style } from "@vanilla-extract/css";

export const throwawayBtn = style({
  backgroundColor: "aqua",
  color: "black",
  padding: "0.5rem",
  transition: "background-color .2s ease",

  ":hover": {
    backgroundColor: "pink",
  },
});

export const throwawayBtnSpan = style({
  transition: "color .2s ease",

  selectors: {
    [`${throwawayBtn} > &`]: {
      color: "red",
      fontStyle: "italic",
    },
    [`${throwawayBtn}:hover > &`]: {
      color: "green",
    },
  },
});
