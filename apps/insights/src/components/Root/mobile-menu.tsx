"use client";

import { Lifebuoy } from "@phosphor-icons/react/dist/ssr/Lifebuoy";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { Button } from "@pythnetwork/component-library/Button";
import { Drawer, DrawerTrigger } from "@pythnetwork/component-library/Drawer";
import { useCallback, useState, useRef } from "react";

import styles from "./mobile-menu.module.scss";
import { SupportDrawer } from "./support-drawer";
import { ThemeSwitch } from "./theme-switch";

type Props = {
  className?: string | undefined;
};

export const MobileMenu = ({ className }: Props) => {
  const [isSupportDrawerOpen, setSupportDrawerOpen] = useState(false);
  const openSupportDrawerOnClose = useRef(false);
  const setOpenSupportDrawerOnClose = useCallback(() => {
    openSupportDrawerOnClose.current = true;
  }, []);
  const maybeOpenSupportDrawer = useCallback(() => {
    if (openSupportDrawerOnClose.current) {
      setSupportDrawerOpen(true);
      openSupportDrawerOnClose.current = false;
    }
  }, [setSupportDrawerOpen]);

  return (
    <>
      <DrawerTrigger>
        <Button
          className={className ?? ""}
          beforeIcon={List}
          variant="ghost"
          size="sm"
          rounded
          hideText
        >
          Menu
        </Button>
        <Drawer hideHeading title="Menu" onCloseFinish={maybeOpenSupportDrawer}>
          <div className={styles.mobileMenu}>
            <div className={styles.buttons}>
              <Button
                slot="close"
                beforeIcon={Lifebuoy}
                variant="ghost"
                size="md"
                rounded
                onPress={setOpenSupportDrawerOnClose}
              >
                Support
              </Button>
              <Button
                href="https://docs.pyth.network"
                size="md"
                rounded
                target="_blank"
              >
                Dev Docs
              </Button>
            </div>
            <div className={styles.theme}>
              <span className={styles.themeLabel}>Theme</span>
              <ThemeSwitch />
            </div>
          </div>
        </Drawer>
      </DrawerTrigger>
      <SupportDrawer
        isOpen={isSupportDrawerOpen}
        onOpenChange={setSupportDrawerOpen}
      />
    </>
  );
};
