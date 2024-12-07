"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useSelectedLayoutSegment } from "next/navigation";
import { type ReactNode, useContext, useEffect, useRef } from "react";

import { TabPanel as TabPanelComponent } from "./tabs";

type Props = {
  children: ReactNode;
};

export const TabPanel = ({ children }: Props) => {
  const segment = useSelectedLayoutSegment();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <MotionTabPanel
        key={segment}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </MotionTabPanel>
    </AnimatePresence>
  );
};

// @ts-expect-error Looks like there's a typing mismatch currently between
// motion and react, probably due to us being on react 19.  I'm expecting this
// will go away when react 19 is officially stabilized...
const MotionTabPanel = motion.create(TabPanelComponent);

const FrozenRouter = ({ children }: { children: ReactNode }) => {
  const context = useContext(LayoutRouterContext);
  // eslint-disable-next-line unicorn/no-null
  const prevContext = usePreviousValue(context) ?? null;

  const segment = useSelectedLayoutSegment();
  const prevSegment = usePreviousValue(segment);

  const changed = segment !== prevSegment && prevSegment !== undefined;

  return (
    <LayoutRouterContext.Provider value={changed ? prevContext : context}>
      {children}
    </LayoutRouterContext.Provider>
  );
};

const usePreviousValue = <T,>(value: T): T | undefined => {
  const prevValue = useRef<T>(undefined);

  useEffect(() => {
    prevValue.current = value;
    return () => {
      prevValue.current = undefined;
    };
  });

  return prevValue.current;
};
