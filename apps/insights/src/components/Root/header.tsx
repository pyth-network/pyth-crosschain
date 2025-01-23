"use client";

import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { Button } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";
import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./header.module.scss";
import Logo from "./logo.svg";
import { SearchButton } from "./search-button";
import { SupportDrawer } from "./support-drawer";
import { MainNavTabs } from "./tabs";
import { ThemeSwitch } from "./theme-switch";
import { MobileMenu } from "../MobileMenu/mobile-menu.v2";

export const Header = ({ className, ...props }: ComponentProps<"header">) => (
  <header className={clsx(styles.header, className)} {...props}>
    <div className={styles.content}>
      <div className={styles.leftMenu}>
        <Link href="/" className={styles.logoLink ?? ""}>
          <div className={styles.logoWrapper}>
            <Logo className={styles.logo} />
          </div>
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.appName}>Insights</div>
        <div className={styles.desktopNavigation}>
          <MainNavTabs />
        </div>
      </div>
      <div className={styles.rightMenu}>
        <div className={styles.desktopSupport}>
          <SupportDrawer>
            <Button beforeIcon={Lifebuoy} variant="ghost" size="sm" rounded>
              Support
            </Button>
          </SupportDrawer>
        </div>
        <SearchButton />
        <div className={styles.desktopDocs}>
          <Button
            href="https://docs.pyth.network"
            size="sm"
            rounded
            target="_blank"
          >
            Dev Docs
          </Button>
        </div>
        <ThemeSwitch className={styles.themeSwitch ?? ""} />
        <MobileMenu />
      </div>
    </div>
  </header>
);
