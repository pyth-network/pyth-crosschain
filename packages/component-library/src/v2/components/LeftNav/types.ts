import type { PropsWithChildren, ReactNode } from "react";

import type { CurrentUser } from "../../types/current-user";
import type { ActionMenuItem } from "../ActionsMenu";

export type LeftNavProps = PropsWithChildren & {
  /**
   * if present and non-empty, will display a vertical
   * ellipsis next to the current user's info that is clickable
   * and these items will be displayed in the menu that opens
   * when clicked
   */
  actionMenuItems: ActionMenuItem[];

  /**
   * if specified, will render this right below the user's email
   * address at the top of the left panel, right next to the
   * user avatar
   */
  additionalUserMeta?: ReactNode;

  /**
   * if true, collapses the panel
   *
   * @defaultValue false
   */
  collapsed?: boolean;

  /**
   * css class name override
   */
  className?: string;

  /**
   * the currently authenticated user logged in for the session
   */
  currentUser: CurrentUser;

  /**
   * additional links to be displayed at the bottom above the
   * currently logged-in user
   */
  supportLinks: ReactNode;

  /**
   * fired whenever somebody toggles the menu open or closed
   */
  onCollapseChange?: (isCollapse: boolean) => void;
};
