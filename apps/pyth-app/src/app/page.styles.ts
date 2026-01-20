import { createKeyframes, createStyles } from "../styles";

const { keyframe: colorWheel } = createKeyframes(
  "index-page-color-wheel",
  () => ({
    "0%": {
      color: "#f00",
    },

    "14%": {
      color: "#ff7f00",
    },

    "28%": {
      color: "#ff0",
    },

    "42%": {
      color: "#0f0",
    },

    "56%": {
      color: "#00f",
    },

    "70%": {
      color: "#4b0082",
    },

    "84%": {
      color: "#9400d3",
    },

    "100%": {
      color: "#f00",
    },
  }),
);

const { keyframe: jitter } = createKeyframes("index-page-jiter", () => ({
  "0%": {
    transform: "translateX(0px) skew(0deg)",
  },
  "33%": {
    transform: "translateX(-2px) skew(-20deg)",
  },
  "66%": {
    transform: "translateX(2px) skew(20deg)",
  },
  "100%": {
    transform: "translateX(0px) skew(0deg)",
  },
}));

export const { classes } = createStyles("root-layout-styles", (theme) => ({
  comingSoon: {
    fontSize: theme.fontSize.xl,
    padding: theme.spacing(6),
    textAlign: "center",

    "& > svg": {
      animation: `${colorWheel} 2s linear infinite`,
      height: theme.spacing(20),
      width: "auto",
    },

    "& > p:last-child": {
      animation: `${jitter} 2s ease infinite`,
    },
  },
  main: {
    ...theme.maxWidth(),
  },
}));
