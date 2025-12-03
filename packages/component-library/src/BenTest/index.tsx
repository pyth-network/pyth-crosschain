import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  root: {
    backgroundColor: "yellow",
    color: "black",
    fontWeight: "bold",
  },
});

export function BenTestComponent() {
  return (
    <div {...stylex.props(styles.root)}>
      I am incredibly <span>loud</span>
    </div>
  );
}
