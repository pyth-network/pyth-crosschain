"use client";

import { ThemeProvider } from "next-themes";
import type { ComponentProps, CSSProperties } from "react";
import { useState } from "react";

import { OverlayVisibleContext } from "../overlay-visible-context.jsx";
import { AlertProvider } from "../useAlert/index.jsx";
import { DrawerProvider } from "../useDrawer/index.jsx";

type TabRootProps = ComponentProps<"div"> & {
  theme?: "dark" | "light" | undefined;
};

export const BodyProviders = ({ theme, ...props }: TabRootProps) => {
  const overlayVisibleState = useState(false);
  const [offset, setOffset] = useState(0);

  return (
    <ThemeProvider {...(theme && { forcedTheme: theme })}>
      <OverlayVisibleContext value={overlayVisibleState}>
        <AlertProvider>
          <DrawerProvider setMainContentOffset={setOffset}>
            <div
              style={{ "--offset": offset / 100 } as CSSProperties}
              data-overlay-visible={overlayVisibleState[0] ? "" : undefined}
              {...props}
            />
          </DrawerProvider>
        </AlertProvider>
      </OverlayVisibleContext>
    </ThemeProvider>
  );
};
