/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
"use client";

import { omitKeys } from "@pythnetwork/shared-lib/util";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Fragment } from "react";

import styles from "./index.module.scss";
import { Skeleton } from "../Skeleton/index.jsx";

type OwnProps =
  | { isLoading: true }
  | {
      isLoading?: false;
      icon: ReactNode | undefined;
      displaySymbol: string;
      description: string;
    };

type Props = Omit<ComponentProps<"div">, keyof OwnProps> & OwnProps;

export const SymbolPairTag = ({ className, ...props }: Props) => (
  <div
    className={clsx(styles.symbolPairTag, className)}
    data-loading={props.isLoading ? "" : undefined}
    {...omitKeys<Record<string, unknown>>(props, [
      "displaySymbol",
      "description",
      "isLoading",
    ])}
  >
    {props.isLoading ? (
      <Skeleton fill className={styles.icon} />
    ) : (
      <div className={styles.icon}>{props.icon}</div>
    )}
    <div className={styles.nameAndDescription}>
      <div className={styles.name} data-symbolname>
        {props.isLoading ? (
          <Skeleton width={30} />
        ) : (
          <SymbolName displaySymbol={props.displaySymbol} />
        )}
      </div>
      {(props.isLoading || props.description) && (
        <div className={styles.description} data-symboldescription>
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

const SymbolName = ({ displaySymbol }: { displaySymbol: string }) => {
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
