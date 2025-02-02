"use client";

import { type ComponentProps, useCallback } from "react";

import { useSelectPriceFeed } from "./price-feed-drawer-provider";
import { PriceComponentsCard } from "../PriceComponentsCard";

export const PriceFeedsCard = (
  props: Omit<
    ComponentProps<typeof PriceComponentsCard>,
    "onPriceComponentAction"
  >,
) => {
  const selectPriceFeed = useSelectPriceFeed();
  const onPriceComponentAction = useCallback(
    ({ symbol }: { symbol: string }) => selectPriceFeed?.(symbol),
    [selectPriceFeed],
  );
  return (
    <PriceComponentsCard
      onPriceComponentAction={onPriceComponentAction}
      {...props}
    />
  );
};
