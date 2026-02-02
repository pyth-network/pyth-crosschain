"use client";
import {
  ArrowSquareOut,
  BookOpenText,
  CreditCard,
  CurrencyCircleDollar,
  Gear,
  HouseLine,
  Key,
  Lifebuoy,
  Lightning,
  Question,
  SignOut,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import type { CurrentUser } from "@pythnetwork/component-library/v2";
import {
  LeftNav,
  NavigationButtonLink,
} from "@pythnetwork/component-library/v2";
import type { ActionMenuItem } from "@pythnetwork/component-library/v2/components/ActionsMenu";
import { useQueryState } from "@pythnetwork/react-hooks/nuqs";
import { useAppTheme } from "@pythnetwork/react-hooks/use-app-theme";
import { capitalCase } from "change-case";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";

import { classes } from "./PythAppLayout.styles";
import { externalRoutes, uiRoutes } from "../../routes";
import { ComingSoonNavLink } from "../ComingSoonNavLink";

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
  const { effectiveTheme, isSystem, toggleTheme } = useAppTheme();

  /** memos */
  const actionMenuItems = useMemo<ActionMenuItem[]>(
    () => [
      {
        component: "Settings",
        icon: Gear,
        key: "account-settings",
      },
      {
        component: (
          <div
            aria-label={`Change theme to ${effectiveTheme === "dark" ? "light" : "dark"}`}
            onClick={toggleTheme}
            onKeyDown={(e) => {
              if (e.key === "Space") toggleTheme();
            }}
            role="button"
            tabIndex={0}
          >
            Theme: {capitalCase(isSystem ? "auto" : effectiveTheme)}
          </div>
        ),
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
    [effectiveTheme, isSystem, toggleTheme],
  );

  return (
    <div className={classes.root}>
      <LeftNav
        actionMenuItems={actionMenuItems}
        additionalUserMeta={"Free Plan"}
        collapsed={leftPanelCollapsed}
        currentUser={dummyCurrentUser}
        supportLinks={
          <>
            <NavigationButtonLink
              afterIcon={ArrowSquareOut}
              beforeIcon={Lifebuoy}
              href={externalRoutes.support()}
              size="sm"
              target="_blank"
            >
              Support
            </NavigationButtonLink>
            <NavigationButtonLink
              afterIcon={ArrowSquareOut}
              beforeIcon={BookOpenText}
              href={externalRoutes.documentation()}
              size="sm"
              target="_blank"
            >
              Documentation
            </NavigationButtonLink>
            <NavigationButtonLink
              afterIcon={ArrowSquareOut}
              beforeIcon={Question}
              href={externalRoutes.faq()}
              size="sm"
              target="_blank"
            >
              FAQ
            </NavigationButtonLink>
          </>
        }
        onCollapseChange={(isCollapsed) => {
          setLeftPanelCollapsed(isCollapsed).catch(() => {
            /* no-op */
          });
        }}
      >
        <NavigationButtonLink
          active={pathname === uiRoutes.dashboard()}
          beforeIcon={HouseLine}
          href={uiRoutes.dashboard()}
        >
          Dashboard
        </NavigationButtonLink>
        <NavigationButtonLink
          active={pathname === uiRoutes.billing()}
          beforeIcon={CreditCard}
          href={uiRoutes.billing()}
        >
          Billing
        </NavigationButtonLink>
        <NavigationButtonLink
          active={pathname === uiRoutes.integration()}
          beforeIcon={Key}
          href={uiRoutes.integration()}
        >
          Integration
        </NavigationButtonLink>
        <ComingSoonNavLink
          active={pathname === uiRoutes.feeds()}
          beforeIcon={TrendUp}
          href={uiRoutes.feeds()}
        >
          Metrics
        </ComingSoonNavLink>
        <ComingSoonNavLink
          active={pathname === uiRoutes.feeds()}
          beforeIcon={CurrencyCircleDollar}
          href={uiRoutes.feeds()}
        >
          Feeds
        </ComingSoonNavLink>
      </LeftNav>
      <main className={classes.main}>{children}</main>
    </div>
  );
}
