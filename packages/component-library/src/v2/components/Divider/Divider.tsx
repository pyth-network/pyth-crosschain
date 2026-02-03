import cx from "clsx";

import { classes } from "./Divider.styles";
import type { DividerSize } from "../../theme/theme";

export type DividerProps = {
  /**
   * css class name override
   */
  className?: string;
  size?: DividerSize;
};

export function Divider({ className, size = "md" }: DividerProps) {
  return <hr className={cx(classes.root, className)} data-size={size} />;
}
