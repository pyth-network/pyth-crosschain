import { createStyles } from "../../../styles";

export const { classes } = createStyles("auth-page", (theme) => ({
  group: {
    ...theme.flexVertical(),
    alignItems: "flex-start",
    gap: theme.spacing(2),
    justifyContent: "center",
    width: "100%",

    "& > *": {
      width: "100%",

      "& input": {
        width: "100%",
      },
    },
  },
  root: {
    ...theme.flexVertical(),
    alignItems: "flex-start",
    flexGrow: 1,
    gap: theme.spacing(12),
    height: "100%",
    justifyContent: "center",
    margin: "0 auto",
    width: "352px", // taken directly from the figma

    "& h1, & h2, & h3, & h4, & h5, & h6": {
      margin: 0,
    },
  },
}));
