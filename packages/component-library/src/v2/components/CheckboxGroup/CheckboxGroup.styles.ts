import { createStyles } from "../../theme/style-funcs";

export const { classes } = createStyles("v2-checkbox-group", (theme) => ({
  checkboxes: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
  },
  label: {
    // ...theme.labelStyles(),
  },
  checkboxGroup: {
    display: "flex",
    flexFlow: "column",
    gap: theme.spacing(2),
  },
}));
