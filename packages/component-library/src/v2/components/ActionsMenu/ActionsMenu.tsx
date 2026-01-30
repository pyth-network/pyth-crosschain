import type { MenuPositionerProps } from "@base-ui/react/menu";
import { Menu } from "@base-ui/react/menu";
import type { Icon } from "@phosphor-icons/react";
import cx from "clsx";
import type { PropsWithChildren, ReactNode } from "react";

import { classes } from "./ActionsMenu.styles";

export type ActionMenuItem = {
  /**
   * the actual component that will be displayed in the Menu.Item
   */
  component: ReactNode;

  /**
   * icon to display to the left-hand-side of each menu item
   */
  icon: Icon;

  /**
   * css class name applied to the icon
   */
  iconClassName?: string;

  /**
   * unique identifier for this action item
   */
  key: string;

  /**
   * called when the menu item is selected
   */
  onSelect?: (() => void) | undefined;
};

export type ActionsMenuProps = Pick<
  MenuPositionerProps,
  "align" | "alignOffset" | "side" | "sideOffset"
> &
  PropsWithChildren & {
    /**
     * css classname override that will be applied to the
     * actions menu popover
     */
    className?: string;

    /**
     * class name override applied specifically to the trigger
     * that opens the actions menu popover
     */
    triggerClassName?: string;

    /**
     * items to display in the menu popover.
     * each will be rendered inside of a Menu.Item
     */
    menuItems: ActionMenuItem[];

    /**
     * friendly, contextual title to display
     * at the top of the menu popover
     */
    popoverTitle: ReactNode;
  };

export function ActionsMenu({
  className,
  children,
  menuItems,
  popoverTitle,
  triggerClassName,
  ...positionerProps
}: ActionsMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cx(triggerClassName)}
        nativeButton={false}
        render={<div className={classes.trigger} />}
      >
        {children}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner {...positionerProps}>
          <Menu.Popup className={cx(classes.menuPopover, className)}>
            <div className={classes.menuPopoverTitle}>{popoverTitle}</div>
            {menuItems.map(
              ({
                component,
                icon: MenuItemIcon,
                iconClassName,
                key,
                onSelect,
              }) => (
                <Menu.Item
                  className={classes.menuItem}
                  key={key}
                  onSelect={onSelect}
                >
                  <MenuItemIcon className={iconClassName} />
                  {component}
                </Menu.Item>
              ),
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
