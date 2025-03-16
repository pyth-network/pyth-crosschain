"use client";

import clsx from "clsx";
import type {
  ComponentProps,
  CSSProperties,
  Dispatch,
  SetStateAction,
} from "react";
import { createContext, useState, use } from "react";

import styles from "./index.module.scss";
import { OverlayVisibleContext } from "../overlay-visible-context.js";

const MainContentOffsetContext = createContext<
  undefined | [number, Dispatch<SetStateAction<number>>]
>(undefined);

export const MainContent = ({ className, ...props }: ComponentProps<"div">) => {
  const overlayVisibleState = useState(false);
  const offset = useState(0);

  return (
    <OverlayVisibleContext value={overlayVisibleState}>
      <MainContentOffsetContext value={offset}>
        <div
          className={clsx(styles.mainContent, className)}
          style={
            {
              "--offset": offset[0] / 100,
            } as CSSProperties
          }
          data-overlay-visible={overlayVisibleState[0] ? "" : undefined}
          {...props}
        />
      </MainContentOffsetContext>
    </OverlayVisibleContext>
  );
};

export const useMainContentOffset = () => {
  const value = use(MainContentOffsetContext);
  if (value === undefined) {
    throw new MainContentNotInitializedError();
  } else {
    return value;
  }
};

class MainContentNotInitializedError extends Error {
  constructor() {
    super("This component must be contained within a <MainContent>");
    this.name = "MainContentNotInitializedError";
  }
}
