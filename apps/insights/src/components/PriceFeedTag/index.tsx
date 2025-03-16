"use client";

import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Fragment } from "react";

import styles from "./index.module.scss";
import { usePriceFeeds } from "../../hooks/use-price-feeds";
import { omitKeys } from "../../omit-keys";

type OwnProps = { compact?: boolean | undefined } & (
  | { isLoading: true }
  | {
      isLoading?: false;
      symbol: string;
    }
);

type Props = Omit<ComponentProps<"div">, keyof OwnProps> & OwnProps;

export const PriceFeedTag = (props: Props) => {
  return props.isLoading ? (
    <PriceFeedTagImpl {...props} />
  ) : (
    <LoadedPriceFeedTag {...props} />
  );
};

const LoadedPriceFeedTag = ({
  symbol,
  ...props
}: Props & { isLoading?: false }) => {
  const feed = usePriceFeeds().get(symbol);
  if (feed) {
    const [firstPart, ...rest] = feed.displaySymbol.split("/");
    return (
      <PriceFeedTagImpl
        description={feed.description}
        feedName={[firstPart ?? "", ...rest]}
        icon={feed.icon}
        {...props}
      />
    );
  } else {
    throw new NoSuchFeedError(symbol);
  }
};

type OwnImplProps = { compact?: boolean | undefined } & (
  | { isLoading: true }
  | {
      isLoading?: false;
      feedName: [string, ...string[]];
      icon: ReactNode;
      description: string;
    }
);

type ImplProps = Omit<ComponentProps<"div">, keyof OwnImplProps> & OwnImplProps;

const PriceFeedTagImpl = ({ className, compact, ...props }: ImplProps) => {
  return (
    <div
      className={clsx(styles.priceFeedTag, className)}
      data-compact={compact ? "" : undefined}
      data-loading={props.isLoading ? "" : undefined}
      {...omitKeys(props, ["feedName", "icon", "description"])}
    >
      {props.isLoading ? (
        <Skeleton fill className={styles.icon} />
      ) : (
        <div className={styles.icon}>{props.icon}</div>
      )}
      <div className={styles.nameAndDescription}>
        <div className={styles.name}>
          {props.isLoading ? (
            <Skeleton width={30} />
          ) : (
            <>
              <span className={styles.firstPart}>{props.feedName[0]}</span>
              {props.feedName.slice(1).map((part, i) => (
                <Fragment key={i}>
                  <span className={styles.divider}>/</span>
                  <span className={styles.part}>{part}</span>
                </Fragment>
              ))}
            </>
          )}
        </div>
        {!compact && (
          <div className={styles.description}>
            {props.isLoading ? (
              <Skeleton width={50} />
            ) : (
              props.description.split("/")[0]
            )}
          </div>
        )}
      </div>
    </div>
  );
};

class NoSuchFeedError extends Error {
  constructor(symbol: string) {
    super(`No feed exists named ${symbol}`);
    this.name = "NoSuchFeedError";
  }
}
