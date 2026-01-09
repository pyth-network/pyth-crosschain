import classes from "./empty-state.module.scss";

export function EmptyState() {
  return (
    <div className={classes.root}>
      To get started, select a source from the dropdown on the top left.
    </div>
  );
}
