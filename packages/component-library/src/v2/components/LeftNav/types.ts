import type { PropsWithChildren } from "react";

import type { CurrentUser } from "../../types/current-user";

export type LeftNavProps = PropsWithChildren & {
  /**
   * css class name override
   */
  className?: string;

  /**
   * the currently authenticated user logged in for the session
   */
  currentUser: CurrentUser;

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
