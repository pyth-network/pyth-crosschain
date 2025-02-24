import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { Button } from "@pythnetwork/component-library/Button";
import { DrawerTrigger } from "@pythnetwork/component-library/Drawer";
import { Link } from "@pythnetwork/component-library/Link";
import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./header.module.scss";
import Logo from "./logo.svg";
import { MobileMenu } from "./mobile-menu";
import { SearchButton, SearchShortcutText } from "./search-button";
import { SupportDrawer } from "./support-drawer";
import { MainNavTabs } from "./tabs";
import { ThemeSwitch } from "./theme-switch";

type Props = ComponentProps<"header"> & {
  tabs: ComponentProps<typeof MainNavTabs>["items"];
};

export const Header = ({ className, tabs, ...props }: Props) => (
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
        <MainNavTabs className={styles.mainNavTabs ?? ""} items={tabs} />
      </div>
      <div className={styles.rightMenu}>
        <DrawerTrigger>
          <Button
            beforeIcon={Lifebuoy}
            variant="ghost"
            size="sm"
            rounded
            className={styles.supportButton ?? ""}
          >
            Support
          </Button>
          <SupportDrawer />
        </DrawerTrigger>
        <SearchButton
          className={styles.outlineSearchButton ?? ""}
          variant="outline"
        >
          <SearchShortcutText />
        </SearchButton>
        <SearchButton
          className={styles.ghostSearchButton ?? ""}
          hideText
          variant="ghost"
        >
          Search
        </SearchButton>
        <MobileMenu className={styles.mobileMenu} />
        <Button
          href="https://docs.pyth.network"
          size="sm"
          rounded
          target="_blank"
          className={styles.mainCta ?? ""}
        >
          Dev Docs
        </Button>
        <ThemeSwitch className={styles.themeSwitch ?? ""} />
      </div>
    </div>
  </header>
);
