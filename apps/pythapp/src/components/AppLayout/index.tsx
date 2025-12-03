import type { PropsWithChildren } from "react";

import classes from "./index.module.scss";

export function AppLayout({ children }: PropsWithChildren) {
  return <div className={classes.root}>{children}</div>;
}
