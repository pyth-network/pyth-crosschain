import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import { type ComponentProps, type ReactNode, Fragment } from "react";

import styles from "./index.module.scss";

type OwnProps =
  | { isLoading: true; compact?: boolean | undefined }
  | ({
      isLoading?: false;
      symbol: string;
      icon: ReactNode;
    } & (
      | { compact: true }
      | {
          compact?: false;
          description: string;
        }
    ));

type Props = Omit<ComponentProps<"div">, keyof OwnProps> & OwnProps;

export const PriceFeedTag = ({ className, ...props }: Props) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { compact, ...propsWithoutCompact } = props;
  return (
    <div
      className={clsx(styles.priceFeedTag, className)}
      data-compact={props.compact ? "" : undefined}
      data-loading={props.isLoading ? "" : undefined}
      {...propsWithoutCompact}
    >
      {props.isLoading ? (
        <Skeleton fill className={styles.icon} />
      ) : (
        <div className={styles.icon}>{props.icon}</div>
      )}
      <div className={styles.nameAndDescription}>
        {props.isLoading ? (
          <div className={styles.name}>
            <Skeleton width={30} />
          </div>
        ) : (
          <FeedName className={styles.name} symbol={props.symbol} />
        )}
        {!props.compact && (
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
