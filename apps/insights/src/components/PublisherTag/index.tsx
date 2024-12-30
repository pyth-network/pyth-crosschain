import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import { type ComponentProps, type ReactNode } from "react";

import styles from "./index.module.scss";
import { PublisherKey } from "../PublisherKey";

type Props =
  | { isLoading: true }
  | ({
      isLoading?: false;
      publisherKey: string;
    } & (
      | { name: string; icon: ReactNode }
      | { name?: undefined; icon?: undefined }
    ));

export const PublisherTag = (props: Props) => (
  <div
    data-loading={props.isLoading ? "" : undefined}
    className={styles.publisherTag}
  >
    {props.isLoading ? (
      <Skeleton fill className={styles.icon} />
    ) : (
      <div className={styles.icon}>{props.icon ?? <UndisclosedIcon />}</div>
    )}
    {props.isLoading ? (
      <Skeleton width={30} />
    ) : (
      <>
        {props.name ? (
          <div className={styles.nameAndKey}>
            <div className={styles.name}>{props.name}</div>
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

const UndisclosedIcon = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={clsx(styles.undisclosedIconWrapper, className)} {...props}>
    <Broadcast className={styles.undisclosedIcon} />
  </div>
);
