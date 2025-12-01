import { css } from "../../styled-system/css";

const classes = {
  root: css({
    backgroundColor: "green",

    "& > h1": {
      fontSize: "6rem",
    },
  }),
};

export function BenTestComponent() {
  return (
    <div className={classes.root}>
      <h1>Pizza Pasta Portofino</h1>
    </div>
  );
}
