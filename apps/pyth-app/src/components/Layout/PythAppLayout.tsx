"use client";
import {
  CreditCard,
  Gear,
  HouseLine,
  Key,
  Lightning,
  SignOut,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import type { CurrentUser } from "@pythnetwork/component-library/v2";
import { LeftNav, LeftNavLink } from "@pythnetwork/component-library/v2";
import type { ActionMenuItem } from "@pythnetwork/component-library/v2/components/ActionsMenu";
import { useQueryState } from "@pythnetwork/react-hooks/nuqs";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";

import { classes } from "./PythAppLayout.styles";
import { uiRoutes } from "../../routes";

type PythAppLayoutProps = PropsWithChildren;

const dummyCurrentUser: CurrentUser = {
  email: "bduran@dourolabs.xyz",
  fullName: "Benjamin Duran",
};

const QUERY_KEY_LEFT_PANEL_COLLAPSED = "lpc";

/**
 * main app layout for app.pyth.network
 */
export function PythAppLayout({ children }: PythAppLayoutProps) {
  /** hooks */
  const pathname = usePathname();
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useQueryState(
    QUERY_KEY_LEFT_PANEL_COLLAPSED,
    { defaultValue: false, parse: (val) => val === "true", shallow: true },
  );

  /** memos */
  const actionMenuItems = useMemo<ActionMenuItem[]>(
    () => [
      {
        component: "Settings",
        icon: Gear,
        key: "account-settings",
      },
      {
        component: "Theme",
        icon: Lightning,
        key: "app-theme",
      },
      {
        component: <span className={classes.signOut}>Sign out</span>,
        icon: SignOut,
        iconClassName: classes.signOut,
        key: "sign-out",
      },
    ],
    [],
  );

  return (
    <div className={classes.root}>
      <LeftNav
        actionMenuItems={actionMenuItems}
        additionalUserMeta={"Free Plan"}
        collapsed={leftPanelCollapsed}
        currentUser={dummyCurrentUser}
        onCollapseChange={(isCollapsed) => {
          setLeftPanelCollapsed(isCollapsed).catch(() => {
            /* no-op */
          });
        }}
      >
        <LeftNavLink
          active={pathname === uiRoutes.dashboard()}
          leftIcon={HouseLine}
          href={uiRoutes.dashboard()}
        >
          Dashboard
        </LeftNavLink>
        <LeftNavLink
          active={pathname === uiRoutes.billing()}
          leftIcon={CreditCard}
          href={uiRoutes.billing()}
        >
          Billing
        </LeftNavLink>
        <LeftNavLink
          active={pathname === uiRoutes.integration()}
          leftIcon={Key}
          href={uiRoutes.integration()}
        >
          Integration
        </LeftNavLink>
        <LeftNavLink
          active={pathname === uiRoutes.feeds()}
          leftIcon={TrendUp}
          href={uiRoutes.feeds()}
        >
          Feeds
        </LeftNavLink>
      </LeftNav>
      <main className={classes.main}>{children}</main>
    </div>
  );
}
