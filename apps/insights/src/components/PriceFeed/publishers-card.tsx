"use client";

import { Switch } from "@pythnetwork/component-library/Switch";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { parseAsBoolean, useQueryState } from "@pythnetwork/react-hooks/nuqs";
import { Suspense, useCallback, useMemo } from "react";

import { Cluster } from "../../services/pyth";
import type { PriceComponent } from "../PriceComponentsCard";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PublisherTag } from "../PublisherTag";

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
  publishers: Omit<PriceComponent, "symbol" | "displaySymbol" | "assetClass">[];
  metricsTime?: Date | undefined;
};

const ResolvedPublishersCard = ({
  publishers,
  ...props
}: ResolvedPublishersCardProps) => {
  const logger = useLogger();

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

  return (
    <PublishersCardImpl
      includeTestFeeds={includeTestFeeds}
      publishers={publishersFilteredByCluster}
      updateIncludeTestFeeds={updateIncludeTestFeeds}
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
    identifiesPublisher
    label="Publishers"
    nameLoadingSkeleton={<PublisherTag isLoading />}
    searchPlaceholder="Publisher key or name"
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
            assetClass: props.assetClass,
            displaySymbol: props.displaySymbol,
            symbol: props.symbol,
          })),
        })}
  />
);
