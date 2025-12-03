import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  loudChild: {
    fontSize: "3rem",
    fontWeight: "bold",
  },
  root: {
    backgroundColor: "yellow",
    color: "black",
    padding: "1rem",
  },
});

export function BenTestComponent() {
  return (
    <div {...stylex.props(styles.root)}>
      I am incredibly <span {...stylex.props(styles.loudChild)}>loud</span>
    </div>
  );
}
