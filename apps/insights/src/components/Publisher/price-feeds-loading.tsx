"use client";

import { PriceComponentsCardContents } from "../PriceComponentsCard";
import { PriceFeedTag } from "../PriceFeedTag";

export const PriceFeedsLoading = () => (
  <PriceComponentsCardContents
    label="Price Feeds"
    searchPlaceholder="Feed symbol"
    nameLoadingSkeleton={<PriceFeedTag compact isLoading />}
    isLoading
    extraColumns={[
      {
        id: "assetClass",
        name: "ASSET CLASS",
        alignment: "left",
        allowsSorting: true,
      },
    ]}
    nameWidth={90}
  />
);
