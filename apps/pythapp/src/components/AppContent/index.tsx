import type { PropsWithChildren } from "react";

import classes from "./index.module.scss";
/**
 * holds everything to the right of the left panel
 */
export function AppContent({ children }: PropsWithChildren) {
  return <section className={classes.root}>{children}</section>;
}
