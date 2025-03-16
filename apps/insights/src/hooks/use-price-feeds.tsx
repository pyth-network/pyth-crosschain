"use client";

import type { ReactNode, ComponentProps } from "react";
import { createContext, use } from "react";

import type { Cluster } from "../services/pyth";

const PriceFeedsContext = createContext<undefined | PriceFeeds>(undefined);

export const PriceFeedsProvider = (
  props: ComponentProps<typeof PriceFeedsContext>,
) => <PriceFeedsContext {...props} />;

export const usePriceFeeds = () => {
  const value = use(PriceFeedsContext);
  if (value) {
    return value;
  } else {
    throw new PriceFeedsNotInitializedError();
  }
};

type PriceFeeds = Map<string, PriceFeed>;

export type PriceFeed = {
  displaySymbol: string;
  icon: ReactNode;
  description: string;
  key: Record<Cluster, string>;
  assetClass: string;
};

class PriceFeedsNotInitializedError extends Error {
  constructor() {
    super(
      "This component must be a child of <PriceFeedsContext> to use the `usePriceFeeds` hook",
    );
    this.name = "PriceFeedsNotInitializedError";
  }
}
