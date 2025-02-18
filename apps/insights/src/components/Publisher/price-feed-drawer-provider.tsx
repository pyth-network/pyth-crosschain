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

import type { Cluster } from "../../services/pyth";
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
  cluster: Cluster;
  priceFeeds: PriceFeed[];
};

type PriceFeed = {
  symbol: string;
  displaySymbol: string;
  description: string;
  icon: ReactNode;
  feedKey: string;
  score: number | undefined;
  rank: number | undefined;
  status: Status;
  firstEvaluation: Date | undefined;
  assetClass: string;
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
  cluster,
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
          displaySymbol={selectedFeed.displaySymbol}
          status={selectedFeed.status}
          firstEvaluation={selectedFeed.firstEvaluation ?? new Date()}
          navigateHref={feedHref}
          title={<PriceFeedTag symbol={selectedFeed.symbol} />}
          cluster={cluster}
          assetClass={selectedFeed.assetClass}
        />
      )}
    </PriceFeedDrawerContext>
  );
};

export const useSelectPriceFeed = () => use(PriceFeedDrawerContext);
