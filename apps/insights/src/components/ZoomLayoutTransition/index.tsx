"use client";

import type { ReactNode } from "react";

import { type VariantArg, LayoutTransition } from "../LayoutTransition";

type Props = {
  children: ReactNode;
};

export const ZoomLayoutTransition = ({ children }: Props) => (
  <LayoutTransition
    variants={{
      initial: (custom) => ({
        opacity: 0,
        scale: getInitialScale(custom),
      }),
      exit: (custom) => ({
        opacity: 0,
        scale: getExitScale(custom),
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

const getInitialScale = ({ segment, prevSegment }: VariantArg) => {
  if (segment === null) {
    return 1.04;
  } else if (prevSegment === null) {
    return 0.96;
  } else {
    return 1;
  }
};

const getExitScale = ({ segment, prevSegment }: VariantArg) => {
  if (segment === null) {
    return 0.96;
  } else if (prevSegment === null) {
    return 1.04;
  } else {
    return 1;
  }
};
