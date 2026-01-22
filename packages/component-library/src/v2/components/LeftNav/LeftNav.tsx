"use client";

import { DotsThreeVertical } from "@phosphor-icons/react/dist/ssr";
import cx from "clsx";
import { useEffect, useRef } from "react";

import { classes } from "./LeftNav.styles";
import type { LeftNavProps } from "./types";
import { PythLogo } from "../../svg/PythLogo";
import { ActionsMenu } from "../ActionsMenu";
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
      data-hasactionsmenu={actionMenuItems.length > 0}
      data-open={open}
    >
      <div className={classes.top}>
        <div className={classes.logoWrapper}>
          <PythLogo />
        </div>
      </div>
      <div className={classes.navLinks}>{children}</div>
      <ActionsMenu
        align="center"
        className={classes.actionsMenuPopover}
        menuItems={actionMenuItems}
        popoverTitle="My Account"
        side="top"
      >
        <span className={classes.currentUser}>
          <Avatar user={currentUser} />
          <span className={classes.currentUserDetails}>
            <span title={currentUser.email}>{currentUser.email}</span>
            <span>{additionalUserMeta}</span>
          </span>
          <span className={classes.ellipsis}>
            <DotsThreeVertical />
          </span>
        </span>
      </ActionsMenu>
    </nav>
  );
}
