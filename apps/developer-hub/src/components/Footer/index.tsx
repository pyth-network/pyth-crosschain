"use client";

import { OverlayVisibleContext } from "@pythnetwork/component-library/overlay-visible-context";
import { AlertProvider } from "@pythnetwork/component-library/useAlert";
import { DrawerProvider } from "@pythnetwork/component-library/useDrawer";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

type Props = {
  children: ReactNode;
};

export function FooterProviders({ children }: Props) {
  const overlayState = useState(false);
  const [offset, setOffset] = useState(0);

  return (
    <OverlayVisibleContext value={overlayState}>
      <AlertProvider>
        <DrawerProvider setMainContentOffset={setOffset}>
          <div
            style={{ "--offset": offset / 100 } as CSSProperties}
            data-overlay-visible={overlayState[0] ? "" : undefined}
          >
            {children}
          </div>
        </DrawerProvider>
      </AlertProvider>
    </OverlayVisibleContext>
  );
}
