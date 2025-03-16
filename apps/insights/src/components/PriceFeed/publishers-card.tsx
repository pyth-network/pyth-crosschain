"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { Switch } from "@pythnetwork/component-library/Switch";
import { useQueryState, parseAsString, parseAsBoolean } from "nuqs";
import type { ComponentProps } from "react";
import { Suspense, useCallback, useMemo } from "react";

import { Cluster, ClusterToName } from "../../services/pyth";
import { PriceComponentDrawer } from "../PriceComponentDrawer";
import {
  PriceComponentsCardContents,
  ResolvedPriceComponentsCard,
} from "../PriceComponentsCard";

type Publisher = ComponentProps<
  typeof ResolvedPriceComponentsCard
>["priceComponents"][number] &
  Pick<ComponentProps<typeof PriceComponentDrawer>, "rank"> & {
    firstEvaluation?: Date | undefined;
  };

type Props = Omit<
  ComponentProps<typeof ResolvedPriceComponentsCard>,
  "onPriceComponentAction" | "priceComponents"
> & {
  priceComponents: Publisher[];
  symbol: string;
  displaySymbol: string;
  assetClass: string;
};

export const PublishersCard = ({
  priceComponents,
  symbol,
  displaySymbol,
  ...props
}: Props) => (
  <Suspense fallback={<PriceComponentsCardContents isLoading {...props} />}>
    <ResolvedPublishersCard
      priceComponents={priceComponents}
      symbol={symbol}
      displaySymbol={displaySymbol}
      {...props}
    />
  </Suspense>
);

const ResolvedPublishersCard = ({
  priceComponents,
  symbol,
  displaySymbol,
  assetClass,
  ...props
}: Props) => {
  const logger = useLogger();
  const { handleClose, selectedPublisher, updateSelectedPublisherKey } =
    usePublisherDrawer(priceComponents);
  const onPriceComponentAction = useCallback(
    ({ publisherKey, cluster }: Publisher) => {
      updateSelectedPublisherKey(
        [ClusterToName[cluster], publisherKey].join(":"),
      );
    },
    [updateSelectedPublisherKey],
  );
  const [includeTestFeeds, setIncludeTestFeeds] = useQueryState(
    "includeTestFeeds",
    parseAsBoolean.withDefault(false),
  );
  const componentsFilteredByCluster = useMemo(
    () =>
      includeTestFeeds
        ? priceComponents
        : priceComponents.filter(
            (component) => component.cluster === Cluster.Pythnet,
          ),
    [includeTestFeeds, priceComponents],
  );
  const updateIncludeTestFeeds = useCallback(
    (newValue: boolean) => {
      setIncludeTestFeeds(newValue).catch((error: unknown) => {
        logger.error(
          "Failed to update include test components query param",
          error,
        );
      });
    },
    [setIncludeTestFeeds, logger],
  );

  return (
    <>
      <ResolvedPriceComponentsCard
        onPriceComponentAction={onPriceComponentAction}
        priceComponents={componentsFilteredByCluster}
        assetClass={assetClass}
        toolbarExtra={
          <Switch
            isSelected={includeTestFeeds}
            onChange={updateIncludeTestFeeds}
          >
            Include test publishers
          </Switch>
        }
        {...props}
      />
      {selectedPublisher && (
        <PriceComponentDrawer
          publisherKey={selectedPublisher.publisherKey}
          onClose={handleClose}
          symbol={symbol}
          displaySymbol={displaySymbol}
          feedKey={selectedPublisher.feedKey}
          rank={selectedPublisher.rank}
          score={selectedPublisher.score}
          status={selectedPublisher.status}
          title={selectedPublisher.name}
          cluster={selectedPublisher.cluster}
          firstEvaluation={selectedPublisher.firstEvaluation ?? new Date()}
          navigateHref={`/publishers/${ClusterToName[selectedPublisher.cluster]}/${selectedPublisher.publisherKey}`}
          assetClass={assetClass}
          identifiesPublisher
        />
      )}
    </>
  );
};

const usePublisherDrawer = (publishers: Publisher[]) => {
  const logger = useLogger();
  const [selectedPublisherKey, setSelectedPublisher] = useQueryState(
    "publisher",
    parseAsString.withDefault("").withOptions({
      history: "push",
    }),
  );
  const updateSelectedPublisherKey = useCallback(
    (newPublisherKey: string) => {
      setSelectedPublisher(newPublisherKey).catch((error: unknown) => {
        logger.error("Failed to update selected publisher", error);
      });
    },
    [setSelectedPublisher, logger],
  );
  const selectedPublisher = useMemo(() => {
    const [cluster, publisherKey] = selectedPublisherKey.split(":");
    return publishers.find(
      (publisher) =>
        publisher.publisherKey === publisherKey &&
        ClusterToName[publisher.cluster] === cluster,
    );
  }, [selectedPublisherKey, publishers]);
  const handleClose = useCallback(() => {
    updateSelectedPublisherKey("");
  }, [updateSelectedPublisherKey]);

  return { selectedPublisher, handleClose, updateSelectedPublisherKey };
};
