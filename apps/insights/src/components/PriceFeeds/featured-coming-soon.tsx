import { Card } from "@pythnetwork/component-library/Card";
import { type ReactNode, Suspense, use } from "react";

import styles from "./featured-coming-soon.module.scss";

type Props = {
  placeholderPriceFeedName: ReactNode;
  comingSoonPromise: Promise<ComingSoonPriceFeed[]>;
};

type ComingSoonPriceFeed = {
  priceFeedName: ReactNode;
};

export const FeaturedComingSoon = ({
  placeholderPriceFeedName,
  comingSoonPromise,
}: Props) => (
  <div className={styles.featuredComingSoon}>
    <Suspense
      fallback={
        <Placeholder placeholderPriceFeedName={placeholderPriceFeedName} />
      }
    >
      <ResolvedFeaturedComingSoon comingSoonPromise={comingSoonPromise} />
    </Suspense>
  </div>
);

type PlaceholderProps = {
  placeholderPriceFeedName: ReactNode;
};

const Placeholder = ({ placeholderPriceFeedName }: PlaceholderProps) => (
  <>
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
    <PlaceholderCard placeholderPriceFeedName={placeholderPriceFeedName} />
  </>
);

const PlaceholderCard = ({ placeholderPriceFeedName }: PlaceholderProps) => (
  <Card title={placeholderPriceFeedName} {...sharedCardProps} />
);

type ResolvedFeaturedComingSoonProps = {
  comingSoonPromise: Promise<ComingSoonPriceFeed[]>;
};

const ResolvedFeaturedComingSoon = ({
  comingSoonPromise,
}: ResolvedFeaturedComingSoonProps) => {
  const comingSoon = use(comingSoonPromise);

  return (
    <>
      {comingSoon.map(({ priceFeedName }, id) => (
        <Card key={id} title={priceFeedName} {...sharedCardProps} />
      ))}
    </>
  );
};

const sharedCardProps = {
  variant: "tertiary" as const,
};
