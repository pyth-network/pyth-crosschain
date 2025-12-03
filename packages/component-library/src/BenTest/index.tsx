import { createStyles } from "simplestyle-js";

const { classes } = createStyles("BenTestComponent", {
  root: {
    backgroundColor: "pink",
    color: "purple",

    "& > h1": {
      fontSize: "4rem",
    },
  },
});

export function BenTestComponent() {
  return (
    <div className={classes.root}>
      <h1>This is just a Ben test component</h1>
      <button type="button">Stuff and things</button>
    </div>
  );
}
