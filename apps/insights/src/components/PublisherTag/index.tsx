import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import clsx from "clsx";
import { type ComponentProps, useMemo } from "react";

import styles from "./index.module.scss";
import { CopyButton } from "../CopyButton";

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
              <CopyButton
                size="xs"
                variant="ghost"
                className={styles.key ?? ""}
                text={props.publisherKey}
              >
                {`${props.publisherKey.slice(0, 4)}...${props.publisherKey.slice(-4)}`}
              </CopyButton>
            </div>
          ) : (
            <CopyButton
              size="sm"
              variant="ghost"
              className={styles.key ?? ""}
              text={props.publisherKey}
            >
              {`${props.publisherKey.slice(0, 4)}...${props.publisherKey.slice(-4)}`}
            </CopyButton>
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
