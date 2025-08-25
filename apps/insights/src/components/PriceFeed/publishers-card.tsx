"use client";

import { Switch } from "@pythnetwork/component-library/Switch";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useQueryState, parseAsBoolean } from "nuqs";
import { Suspense, useCallback, useMemo } from "react";

import { Cluster } from "../../services/pyth";
import type { PriceComponent } from "../PriceComponentsCard";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PublisherTag } from "../PublisherTag";
import { useLivePriceData } from '../../hooks/use-live-price-data';
import { Status } from '../../status';

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
  publishers: Omit<PriceComponent, "status" | "symbol" | "displaySymbol" | "assetClass">[];
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
    const currentSlot = data.current?.validSlot;
    const isInactive = (publishSlot: number, currentSlot: number) => publishSlot < currentSlot - 100;

    return publishersFilteredByCluster.map((publisher) => {
      const lastPublishedSlot = data.current?.priceComponents.find((price) => price.publisher.toString() === publisher.publisherKey.toString())?.latest.publishSlot;
      const isPublisherInactive = isInactive(Number(lastPublishedSlot ?? 0), Number(currentSlot ?? 0));

      return {
      ...publisher,
      status: isPublisherInactive ? Status.Down : Status.Live,
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
  | (ResolvedPublishersCardProps & {
      isLoading?: false | undefined;
      includeTestFeeds: boolean;
      updateIncludeTestFeeds: (newValue: boolean) => void;
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
