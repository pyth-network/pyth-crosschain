import { CaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import clsx from "clsx";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";

const SKELETON_WIDTH = 15;

type OwnProps =
  | { isLoading: true; skeletonWidth?: number | undefined }
  | {
      isLoading?: false;
      direction: "up" | "down" | "flat";
    };

type Props = Omit<ComponentProps<"span">, keyof OwnProps> & OwnProps;

export const ChangeValue = ({ className, children, ...props }: Props) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isLoading, ...propsWithoutIsLoading } = props;
  return (
    <span
      className={clsx(styles.changeValue, className)}
      {...(!props.isLoading && { "data-direction": props.direction })}
      {...propsWithoutIsLoading}
    >
      <Contents {...props}>{children}</Contents>
    </span>
  );
};

const Contents = (props: Props) => {
  if (props.isLoading) {
    return <Skeleton width={props.skeletonWidth ?? SKELETON_WIDTH} />;
  } else if (props.direction === "flat") {
    return "-";
  } else {
    return (
      <>
        <CaretUp weight="fill" className={styles.caret} />
        {props.children}
      </>
    );
  }
};
