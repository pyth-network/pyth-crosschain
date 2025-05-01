"use client";

import clsx from "clsx";
import type { ComponentProps, CSSProperties } from "react";
import { useState } from "react";

import styles from "./index.module.scss";
import { OverlayVisibleContext } from "../overlay-visible-context.js";
import { AlertProvider } from "../useAlert/index.js";
import { DrawerProvider } from "../useDrawer/index.js";

export const MainContent = ({ className, ...props }: ComponentProps<"div">) => {
  const overlayVisibleState = useState(false);
  const [offset, setOffset] = useState(0);

  return (
    <OverlayVisibleContext value={overlayVisibleState}>
      <AlertProvider>
        <DrawerProvider setMainContentOffset={setOffset}>
          <div
            className={clsx(styles.mainContent, className)}
            style={{ "--offset": offset / 100 } as CSSProperties}
            data-overlay-visible={overlayVisibleState[0] ? "" : undefined}
            {...props}
          />
        </DrawerProvider>
      </AlertProvider>
    </OverlayVisibleContext>
  );
};
