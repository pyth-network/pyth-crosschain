"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { parseAsString, useQueryState } from "nuqs";
import {
  type ReactNode,
  type ComponentProps,
  Suspense,
  createContext,
  useMemo,
  useCallback,
  use,
} from "react";

import type { Status } from "../../status";
import { PriceComponentDrawer } from "../PriceComponentDrawer";
import { PriceFeedTag } from "../PriceFeedTag";

const PriceFeedDrawerContext = createContext<
  ((symbol: string) => void) | undefined
>(undefined);

type PriceFeedDrawerProviderProps = Omit<
  ComponentProps<typeof PriceFeedDrawerContext>,
  "value"
> & {
  publisherKey: string;
  priceFeeds: PriceFeeds[];
};

type PriceFeeds = {
  symbol: string;
  displaySymbol: string;
  description: string;
  icon: ReactNode;
  feedKey: string;
  score: number | undefined;
  rank: number | undefined;
  status: Status;
};

export const PriceFeedDrawerProvider = (
  props: PriceFeedDrawerProviderProps,
) => (
  <Suspense fallback={props.children}>
    <PriceFeedDrawerProviderImpl {...props} />
  </Suspense>
);

const PriceFeedDrawerProviderImpl = ({
  publisherKey,
  priceFeeds,
  children,
}: PriceFeedDrawerProviderProps) => {
  const logger = useLogger();
  const [selectedSymbol, setSelectedSymbol] = useQueryState(
    "price-feed",
    parseAsString.withDefault("").withOptions({
      history: "push",
    }),
  );
  const updateSelectedSymbol = useCallback(
    (newSymbol: string) => {
      setSelectedSymbol(newSymbol).catch((error: unknown) => {
        logger.error("Failed to update selected symbol", error);
      });
    },
    [setSelectedSymbol, logger],
  );
  const selectedFeed = useMemo(
    () => priceFeeds.find((feed) => feed.symbol === selectedSymbol),
    [selectedSymbol, priceFeeds],
  );
  const handleClose = useCallback(() => {
    updateSelectedSymbol("");
  }, [updateSelectedSymbol]);
  const feedHref = useMemo(
    () => `/price-feeds/${encodeURIComponent(selectedFeed?.symbol ?? "")}`,
    [selectedFeed],
  );

  return (
    <PriceFeedDrawerContext value={updateSelectedSymbol}>
      {children}
      {selectedFeed && (
        <PriceComponentDrawer
          publisherKey={publisherKey}
          onClose={handleClose}
          feedKey={selectedFeed.feedKey}
          rank={selectedFeed.rank}
          score={selectedFeed.score}
          symbol={selectedFeed.symbol}
          status={selectedFeed.status}
          navigateButtonText="Open Feed"
          navigateHref={feedHref}
          title={
            <PriceFeedTag
              symbol={selectedFeed.displaySymbol}
              description={selectedFeed.description}
              icon={selectedFeed.icon}
            />
          }
        />
      )}
    </PriceFeedDrawerContext>
  );
};

export const useSelectPriceFeed = () => use(PriceFeedDrawerContext);
