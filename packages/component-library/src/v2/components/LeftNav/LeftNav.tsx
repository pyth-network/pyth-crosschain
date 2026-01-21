"use client";

import { Menu } from "@base-ui/react/menu";
import { CaretDown, DotsThreeVertical } from "@phosphor-icons/react/dist/ssr";
import cx from "clsx";
import { useEffect, useRef } from "react";

import { classes } from "./component.styles";
import type { LeftNavProps } from "./types";
import { PythLogo } from "../../svg/PythLogo";
import { Avatar } from "../Avatar";

export function LeftNav({
  actionMenuItems,
  additionalUserMeta,
  children,
  className,
  currentUser,
  onOpenChange,
  open = true,
}: LeftNavProps) {
  /** refs */
  const onOpenChangeRef = useRef(onOpenChange);

  /** effects */
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  return (
    <nav
      className={cx(classes.root, className)}
      data-hasactionsmenu={Boolean(actionMenuItems?.length)}
      data-open={open}
    >
      <div className={classes.top}>
        <div className={classes.logoWrapper}>
          <PythLogo />
        </div>
      </div>
      <div className={classes.navLinks}>{children}</div>
      <div className={classes.currentUser}>
        <Avatar user={currentUser} />
        <div className={classes.currentUserDetails}>
          <div title={currentUser.email}>{currentUser.email}</div>
          <div>{additionalUserMeta}</div>
        </div>
        {actionMenuItems?.length && (
          <Menu.Root>
            <Menu.Trigger
              aria-label="Show additional user account actions"
              className={classes.actionsMenuTrigger}
            >
              <DotsThreeVertical />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Arrow>
                    <CaretDown />
                  </Menu.Arrow>
                  {actionMenuItems.map((node, i) => (
                    <Menu.Item key={`action-menu-item-${i.toString()}`}>
                      {node}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </nav>
  );
}
