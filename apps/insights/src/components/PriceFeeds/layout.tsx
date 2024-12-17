"use client";

import type { ReactNode } from "react";

import { type VariantArg, LayoutTransition } from "../LayoutTransition";

type Props = {
  children: ReactNode;
};

export const PriceFeedsLayout = ({ children }: Props) => (
  <LayoutTransition
    variants={{
      initial: (custom) => ({
        opacity: 0,
        scale: isGoingToIndex(custom) ? 1.04 : 0.96,
      }),
      exit: (custom) => ({
        opacity: 0,
        scale: isGoingToIndex(custom) ? 0.96 : 1.04,
        transition: {
          scale: { type: "spring", bounce: 0 },
        },
      }),
    }}
    initial="initial"
    animate={{
      opacity: 1,
      scale: 1,
      transition: {
        scale: { type: "spring", bounce: 0 },
      },
    }}
    style={{ transformOrigin: "top" }}
    exit="exit"
  >
    {children}
  </LayoutTransition>
);

const isGoingToIndex = ({ segment }: VariantArg) => segment === null;
