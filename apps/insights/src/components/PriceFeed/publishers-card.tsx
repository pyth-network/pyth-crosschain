"use client";

import { useLogger } from "@pythnetwork/app-logger";
import {
  useQueryState,
  parseAsString, // , parseAsBoolean
} from "nuqs";
import { type ComponentProps, Suspense, useCallback, useMemo } from "react";

import { PriceComponentDrawer } from "../PriceComponentDrawer";
import {
  PriceComponentsCardContents,
  ResolvedPriceComponentsCard,
} from "../PriceComponentsCard";
// import { Cluster } from "../../services/pyth";

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
};

export const PublishersCard = ({ priceComponents, ...props }: Props) => (
  <Suspense fallback={<PriceComponentsCardContents isLoading {...props} />}>
    <ResolvedPublishersCard priceComponents={priceComponents} {...props} />
  </Suspense>
);

const ResolvedPublishersCard = ({ priceComponents, ...props }: Props) => {
  // const logger = useLogger();
  const { handleClose, selectedPublisher, updateSelectedPublisherKey } =
    usePublisherDrawer(priceComponents);
  const onPriceComponentAction = useCallback(
    ({ publisherKey }: Publisher) => {
      updateSelectedPublisherKey(publisherKey);
    },
    [updateSelectedPublisherKey],
  );
  // const [includeTestFeeds, setIncludeTestFeeds] = useQueryState(
  //   "includeTestFeeds",
  //   parseAsBoolean.withDefault(false),
  // );
  // const componentsFilteredByCluster = useMemo(
  //   () =>
  //     includeTestFeeds
  //       ? priceComponents
  //       : priceComponents.filter(
  //           (component) => component.cluster === Cluster.Pythnet,
  //         ),
  //   [includeTestFeeds, priceComponents],
  // );
  // const updateIncludeTestFeeds = useCallback(
  //   (newValue: boolean) => {
  //     setIncludeTestFeeds(newValue).catch((error: unknown) => {
  //       logger.error(
  //         "Failed to update include test components query param",
  //         error,
  //       );
  //     });
  //   },
  //   [setIncludeTestFeeds, logger],
  // );
  //         <Switch
  //           {...(props.isLoading
  //             ? { isLoading: true }
  //             : {
  //                 isSelected: props.includeTestFeeds,
  //                 onChange: props.onIncludeTestFeedsChange,
  //               })}
  //         >
  //           Show test feeds
  //         </Switch>

  return (
    <>
      <ResolvedPriceComponentsCard
        onPriceComponentAction={onPriceComponentAction}
        // priceComponents={componentsFilteredByCluster}
        priceComponents={priceComponents}
        {...props}
      />
      {selectedPublisher && (
        <PriceComponentDrawer
          publisherKey={selectedPublisher.publisherKey}
          onClose={handleClose}
          symbol={selectedPublisher.symbol}
          feedKey={selectedPublisher.feedKey}
          rank={selectedPublisher.rank}
          score={selectedPublisher.score}
          status={selectedPublisher.status}
          title={selectedPublisher.name}
          firstEvaluation={selectedPublisher.firstEvaluation ?? new Date()}
          navigateButtonText="Open Publisher"
          navigateHref={`/publishers/${selectedPublisher.publisherKey}`}
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
  const selectedPublisher = useMemo(
    () =>
      publishers.find(
        (publisher) => publisher.publisherKey === selectedPublisherKey,
      ),
    [selectedPublisherKey, publishers],
  );
  const handleClose = useCallback(() => {
    updateSelectedPublisherKey("");
  }, [updateSelectedPublisherKey]);

  return { selectedPublisher, handleClose, updateSelectedPublisherKey };
};
