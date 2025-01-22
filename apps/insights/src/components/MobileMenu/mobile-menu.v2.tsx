"use client";
import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { X } from "@phosphor-icons/react/dist/ssr/X";
import { Button } from "@pythnetwork/component-library/Button";
import clsx from "clsx";
import { useTheme } from "next-themes";
import { useState } from "react";

import styles from "./mobile-menu.module.scss";
import { SupportDrawer } from "../Root/support-drawer";
import { ThemeSwitch } from "../Root/theme-switch";

export const MobileMenu = ({
  className,
  ...props
}: {
  className?: string | string[];
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={clsx(styles.mobileMenuTrigger, className)} {...props}>
      <Button
        variant="ghost"
        size="sm"
        afterIcon={List}
        rounded
        onPress={toggleMenu}
      >
        Menu
      </Button>
      {isOpen && (
        <div className={styles.mobileMenuOverlay}>
          <div className={styles.mobileMenuContainer}>
            <div className={styles.mobileMenuHandle} />
            <Button
              href="https://docs.pyth.network"
              size="md"
              rounded
              target="_blank"
            >
              Dev Docs
            </Button>
            <SupportDrawer>
              <Button beforeIcon={Lifebuoy} variant="ghost" size="md" rounded>
                Support
              </Button>
            </SupportDrawer>
            <div className={styles.mobileThemeSwitcher}>
              <div>Theme</div>
              <div className={styles.mobileThemeSwitcherFeedback}>
                <div>{theme}</div>
                <ThemeSwitch />
              </div>
            </div>
            <Button
              variant="outline"
              afterIcon={X}
              rounded
              onPress={toggleMenu}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
