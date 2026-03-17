"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { use } from "react";
import { TabListStateContext } from "react-aria-components";

import { TabPanel as UnstyledTabPanel } from "../unstyled/Tabs/index.jsx";

const AnimatedPanel = motion.create(UnstyledTabPanel);

type Props = {
  items: {
    id: string;
    className?: string;
    children: ReactNode;
  }[];
};

export const CrossfadeTabPanels = ({ items }: Props) => {
  const state = use(TabListStateContext);

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {state && (
        <AnimatedPanel
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={state.selectedKey}
          shouldForceMount
          transition={{ duration: 0.5, ease: "linear" }}
          {...items.find((item) => item.id === state.selectedKey)}
        />
      )}
    </AnimatePresence>
  );
};
