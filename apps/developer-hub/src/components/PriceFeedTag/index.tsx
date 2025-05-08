import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Fragment } from "react";

import styles from "./index.module.scss";
import { omitKeys } from "../../omit-keys";

type OwnProps =
  | { isLoading: true }
  | {
      isLoading?: false;
      icon: ReactNode | undefined;
      displaySymbol: string;
      description: string;
    };

type Props = Omit<ComponentProps<"div">, keyof OwnProps> & OwnProps;

export const PriceFeedTag = ({ className, ...props }: Props) => (
  <div
    className={clsx(styles.priceFeedTag, className)}
    data-loading={props.isLoading ? "" : undefined}
    {...omitKeys(props, ["displaySymbol", "description", "isLoading"])}
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
          <FeedName displaySymbol={props.displaySymbol} />
        )}
      </div>
      <div className={styles.description}>
        {props.isLoading ? (
          <Skeleton width={50} />
        ) : (
          props.description.split("/")[0]
        )}
      </div>
    </div>
  </div>
);

const FeedName = ({ displaySymbol }: { displaySymbol: string }) => {
  const [firstPart, ...rest] = displaySymbol.split("/");
  return (
    <>
      <span className={styles.firstPart}>{firstPart}</span>
      {rest.map((part, i) => (
        <Fragment key={i}>
          <span className={styles.divider}>/</span>
          <span className={styles.part}>{part}</span>
        </Fragment>
      ))}
    </>
  );
};
