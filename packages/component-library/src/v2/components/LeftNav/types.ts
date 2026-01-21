import type { PropsWithChildren, ReactNode } from "react";

import type { CurrentUser } from "../../types/current-user";

export type LeftNavProps = PropsWithChildren & {
  /**
   * if present and non-empty, will display a vertical
   * ellipsis next to the current user's info that is clickable
   * and these items will be displayed in the menu that opens
   * when clicked
   */
  actionMenuItems?: ReactNode[];

  /**
   * if specified, will render this right below the user's email
   * address at the top of the left panel, right next to the
   * user avatar
   */
  additionalUserMeta?: ReactNode;

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
