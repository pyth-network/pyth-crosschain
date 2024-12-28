import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import clsx from "clsx";
import { type ComponentProps, useMemo } from "react";

import styles from "./index.module.scss";
import { PublisherKey } from "../PublisherKey";

type Props = { isLoading: true } | { isLoading?: false; publisherKey: string };

export const PublisherTag = (props: Props) => {
  const knownPublisher = useMemo(
    () => (props.isLoading ? undefined : lookupPublisher(props.publisherKey)),
    [props],
  );
  const Icon = knownPublisher?.icon.color ?? UndisclosedIcon;
  return (
    <div
      data-loading={props.isLoading ? "" : undefined}
      className={styles.publisherTag}
    >
      {props.isLoading ? (
        <Skeleton fill className={styles.icon} />
      ) : (
        <Icon className={styles.icon} />
      )}
      {props.isLoading ? (
        <Skeleton width={30} />
      ) : (
        <>
          {knownPublisher ? (
            <div className={styles.nameAndKey}>
              <div className={styles.name}>{knownPublisher.name}</div>
              <PublisherKey
                className={styles.key ?? ""}
                publisherKey={props.publisherKey}
                size="xs"
              />
            </div>
          ) : (
            <PublisherKey publisherKey={props.publisherKey} size="sm" />
          )}
        </>
      )}
    </div>
  );
};

const UndisclosedIcon = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={clsx(styles.undisclosedIconWrapper, className)} {...props}>
    <Broadcast className={styles.undisclosedIcon} />
  </div>
);
