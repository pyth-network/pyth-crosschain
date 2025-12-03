import { HandPointing } from "@phosphor-icons/react/dist/ssr";

import classes from "./empty-state.module.scss";

export function EmptyState() {
  return (
    <div className={classes.root}>
      To get started, select a source from the dropdown, above <HandPointing />
    </div>
  );
}
