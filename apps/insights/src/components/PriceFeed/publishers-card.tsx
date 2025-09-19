"use client";

import { Switch } from "@pythnetwork/component-library/Switch";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Suspense, useCallback, useMemo } from "react";

import { useLivePriceData } from "../../hooks/use-live-price-data";
import { Cluster } from "../../services/pyth";
import type { PriceComponent } from "../PriceComponentsCard";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PublisherTag } from "../PublisherTag";
import { getStatus } from "../Status";

type PublishersCardProps =
  | { isLoading: true }
  | (ResolvedPublishersCardProps & {
      isLoading?: false | undefined;
    });

export const PublishersCard = (props: PublishersCardProps) =>
  props.isLoading ? (
    <PublishersCardImpl {...props} />
  ) : (
    <Suspense>
      <ResolvedPublishersCard {...props} />
    </Suspense>
  );

type ResolvedPublishersCardProps = {
  symbol: string;
  displaySymbol: string;
  assetClass: string;
  publishers: Omit<
    PriceComponent,
    "status" | "symbol" | "displaySymbol" | "assetClass"
  >[];
  metricsTime?: Date | undefined;
};

const ResolvedPublishersCard = ({
  publishers,
  ...props
}: ResolvedPublishersCardProps) => {
  const logger = useLogger();
  const data = useLivePriceData(Cluster.Pythnet, publishers[0]?.feedKey);

  const [includeTestFeeds, setIncludeTestFeeds] = useQueryState(
    "includeTestFeeds",
    parseAsBoolean.withDefault(false),
  );

  const updateIncludeTestFeeds = useCallback(
    (newValue: boolean) => {
      setIncludeTestFeeds(newValue).catch((error: unknown) => {
        logger.error("Failed to update show quality", error);
      });
    },
    [setIncludeTestFeeds, logger],
  );

  const publishersFilteredByCluster = useMemo(
    () =>
      includeTestFeeds
        ? publishers
        : publishers.filter(
            (component) => component.cluster === Cluster.Pythnet,
          ),
    [includeTestFeeds, publishers],
  );

  const publishersWithStatus = useMemo(() => {
    return publishersFilteredByCluster.map((publisher) => {
      return {
        ...publisher,
        status: getStatus(data.current, publisher.publisherKey),
      };
    });
  }, [publishersFilteredByCluster, data]);

  return (
    <PublishersCardImpl
      includeTestFeeds={includeTestFeeds}
      updateIncludeTestFeeds={updateIncludeTestFeeds}
      publishers={publishersWithStatus}
      {...props}
    />
  );
};

type PublishersCardImplProps =
  | { isLoading: true }
  | (Omit<ResolvedPublishersCardProps, "publishers"> & {
      isLoading?: false | undefined;
      includeTestFeeds: boolean;
      updateIncludeTestFeeds: (newValue: boolean) => void;
      publishers: Omit<
        PriceComponent,
        "symbol" | "displaySymbol" | "assetClass"
      >[];
    });

const PublishersCardImpl = (props: PublishersCardImplProps) => (
  <PriceComponentsCard
    label="Publishers"
    searchPlaceholder="Publisher key or name"
    nameLoadingSkeleton={<PublisherTag isLoading />}
    identifiesPublisher
    toolbarExtra={
      <Switch
        {...(props.isLoading
          ? { isPending: true }
          : {
              isSelected: props.includeTestFeeds,
              onChange: props.updateIncludeTestFeeds,
            })}
      >
        Include test publishers
      </Switch>
    }
    {...(props.isLoading
      ? { isLoading: true }
      : {
          assetClass: props.assetClass,
          metricsTime: props.metricsTime,
          priceComponents: props.publishers.map((feed) => ({
            ...feed,
            symbol: props.symbol,
            displaySymbol: props.displaySymbol,
            assetClass: props.assetClass,
          })),
        })}
  />
);
