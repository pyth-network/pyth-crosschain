import { createStyles } from "../../styles";

export const { classes } = createStyles("coming-soon-nav-link", (theme) => ({
  root: {
    ...theme.flexHorizontalCenter(),
    flexGrow: 1,
    gap: theme.spacing(2),
    justifyContent: "space-between",
  },
}));
