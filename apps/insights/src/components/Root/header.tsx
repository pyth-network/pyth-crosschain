import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { AppTabs } from "@pythnetwork/component-library/AppTabs";
import { Button, ButtonLink } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";
import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./header.module.scss";
import Logo from "./logo.svg";
import { SearchButton } from "./search-button";
import { ThemeSwitch } from "./theme-switch";

export const Header = ({ className, ...props }: ComponentProps<"header">) => (
  <header className={clsx(styles.header, className)} {...props}>
    <div className={styles.content}>
      <div className={styles.leftMenu}>
        <Link href="https://www.pyth.network">
          <Logo className={styles.logo} />
          <div className={styles.logoLabel}>Pyth Homepage</div>
        </Link>
        <div className={styles.appName}>Insights</div>
        <AppTabs
          tabs={[
            { href: "/", id: "/", children: "Overview" },
            { href: "/publishers", id: "/publishers", children: "Publishers" },
            {
              href: "/price-feeds",
              id: "/price-feeds",
              children: "Price Feeds",
            },
          ]}
        />
      </div>
      <div className={styles.rightMenu}>
        <Button beforeIcon={Lifebuoy} variant="ghost" size="sm" rounded>
          Support
        </Button>
        <SearchButton />
        <ButtonLink
          href="https://docs.pyth.network"
          size="sm"
          rounded
          target="_blank"
        >
          Dev Docs
        </ButtonLink>
        <ThemeSwitch className={styles.themeSwitch ?? ""} />
      </div>
    </div>
  </header>
);
