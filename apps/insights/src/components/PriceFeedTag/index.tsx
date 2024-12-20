import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import Generic from "cryptocurrency-icons/svg/color/generic.svg";
import { type ComponentProps, Fragment } from "react";

import { icons } from "./icons";
import styles from "./index.module.scss";

type OwnProps = {
  compact?: boolean | undefined;
} & (
  | { isLoading: true }
  | {
      isLoading?: false;
      feed: {
        product: {
          display_symbol: string;
          description: string;
        };
      };
    }
);

type Props = Omit<ComponentProps<"div">, keyof OwnProps> & OwnProps;

export const PriceFeedTag = ({ className, compact, ...props }: Props) => (
  <div
    className={clsx(styles.priceFeedTag, className)}
    data-compact={compact ? "" : undefined}
    data-loading={props.isLoading ? "" : undefined}
    {...props}
  >
    {props.isLoading ? (
      <Skeleton fill className={styles.icon} />
    ) : (
      <FeedIcon
        className={styles.icon}
        symbol={props.feed.product.display_symbol}
      />
    )}
    <div className={styles.nameAndDescription}>
      {props.isLoading ? (
        <div className={styles.name}>
          <Skeleton width={30} />
        </div>
      ) : (
        <FeedName
          className={styles.name}
          symbol={props.feed.product.display_symbol}
        />
      )}
      {!compact && (
        <div className={styles.description}>
          {props.isLoading ? (
            <Skeleton width={50} />
          ) : (
            props.feed.product.description.split("/")[0]
          )}
        </div>
      )}
    </div>
  </div>
);

type OwnFeedNameProps = { symbol: string };
type FeedNameProps = Omit<ComponentProps<"div">, keyof OwnFeedNameProps> &
  OwnFeedNameProps;

const FeedName = ({ symbol, className, ...props }: FeedNameProps) => {
  const [firstPart, ...parts] = symbol.split("/");

  return (
    <div className={clsx(styles.priceFeedName, className)} {...props}>
      <span className={styles.firstPart}>{firstPart}</span>
      {parts.map((part, i) => (
        <Fragment key={i}>
          <span className={styles.divider}>/</span>
          <span className={styles.part}>{part}</span>
        </Fragment>
      ))}
    </div>
  );
};

type OwnFeedIconProps = {
  symbol: string;
};
type FeedIconProps = Omit<
  ComponentProps<typeof Generic>,
  keyof OwnFeedIconProps | "width" | "height" | "viewBox"
> &
  OwnFeedIconProps;

const FeedIcon = ({ symbol, ...props }: FeedIconProps) => {
  const firstPart = symbol.split("/")[0];
  const Icon =
    firstPart && firstPart in icons
      ? icons[firstPart as keyof typeof icons]
      : Generic;

  return <Icon width="100%" height="100%" viewBox="0 0 32 32" {...props} />;
};
