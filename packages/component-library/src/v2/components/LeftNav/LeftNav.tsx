"use client";

import {
  CaretDoubleLeft,
  CaretDoubleRight,
  DotsThreeVertical,
} from "@phosphor-icons/react/dist/ssr";
import cx from "clsx";

import { classes } from "./LeftNav.styles";
import type { LeftNavProps } from "./types";
import { PythLogo } from "../../svg/PythLogo";
import { ActionsMenu } from "../ActionsMenu";
import { Avatar } from "../Avatar";
import { Button } from "../Button";

export function LeftNav({
  actionMenuItems,
  additionalUserMeta,
  children,
  className,
  collapsed = false,
  currentUser,
  onCollapseChange,
  supportLinks,
}: LeftNavProps) {
  /** local variables */
  const collapseButtonTooltip = `${collapsed ? "Expand" : "Collapse"} left navigation panel`;

  return (
    <nav
      className={cx(classes.root, className)}
      data-hasactionsmenu={actionMenuItems.length > 0}
      data-collapsed={collapsed}
      data-open={!collapsed}
    >
      <div className={classes.top}>
        <div className={classes.logoWrapper}>
          {!collapsed && <PythLogo />}
          <Button
            aria-label={collapseButtonTooltip}
            beforeIcon={collapsed ? CaretDoubleRight : CaretDoubleLeft}
            onClick={() => {
              onCollapseChange?.(!collapsed);
            }}
            tooltip={collapseButtonTooltip}
            variant="ghost"
          />
        </div>
      </div>
      <div className={classes.navLinks}>{children}</div>
      <div className={classes.supportLinks}>{supportLinks}</div>
      <ActionsMenu
        align="center"
        className={classes.actionsMenuPopover}
        triggerClassName={classes.actionsMenuTrigger}
        menuItems={actionMenuItems}
        popoverTitle="My Account"
        side="top"
      >
        <Button
          className={classes.currentUser}
          data-currentusermenu
          variant="ghost"
        >
          <Avatar user={currentUser} />
          <span className={classes.currentUserDetails}>
            <span title={currentUser.email}>{currentUser.email}</span>
            <span>{additionalUserMeta}</span>
          </span>
          <span className={classes.ellipsis}>
            <DotsThreeVertical />
          </span>
        </Button>
      </ActionsMenu>
    </nav>
  );
}
