import type { PropsWithChildren } from "react";

export type LeftNavProps = PropsWithChildren & {
  /**
   * css class name override
   */
  className?: string;

  /**
   * fired whenever somebody toggles the menu open or closed
   */
  onOpenChange?: (isOpen: boolean) => void;

  /**
   * if provided, controls the open or closed state
   * of the left nav.
   *
   * @defaultValue true
   */
  open?: boolean;
};
