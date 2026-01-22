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

/**
 * main app layout for app.pyth.network
 */
export function PythAppLayout({ children }: PythAppLayoutProps) {
  /** hooks */
  const pathname = usePathname();

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
        currentUser={dummyCurrentUser}
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
