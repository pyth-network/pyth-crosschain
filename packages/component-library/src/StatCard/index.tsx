import clsx from "clsx";
import type { ReactNode, ElementType } from "react";

import styles from "./index.module.scss";
import { type Props as CardProps, Card } from "../Card/index.js";

type OwnPropsSingle = {
  header: ReactNode;
  stat: ReactNode;
  miniStat?: ReactNode | undefined;
  corner?: ReactNode | undefined;
  small?: boolean | undefined;
};

type OwnPropsDual = {
  header1: ReactNode;
  header2: ReactNode;
  stat1: ReactNode;
  stat2: ReactNode;
  miniStat1?: ReactNode | undefined;
  miniStat2?: ReactNode | undefined;
};

type Props<T extends ElementType> = Omit<
  CardProps<T>,
  | keyof OwnPropsSingle
  | keyof OwnPropsDual
  | "title"
  | "toolbar"
  | "icon"
  | "footer"
> &
  (OwnPropsSingle | OwnPropsDual);

export const StatCard = <T extends ElementType>({
  className,
  children,
  ...props
}: Props<T>) => {
  const {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    header,
    stat,
    miniStat,
    corner,
    small,
    header1,
    header2,
    stat1,
    stat2,
    miniStat1,
    miniStat2,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    ...cardProps
  } = props;
  return (
    <Card className={clsx(styles.statCard, className)} {...cardProps}>
      <div className={styles.cardContents}>
        <div className={styles.top}>
          {"header" in props ? (
            <>
              {props.corner && (
                <div className={styles.corner}>{props.corner}</div>
              )}
              <h2 className={styles.header}>{props.header}</h2>
              <div
                data-small={props.small ? "" : undefined}
                className={styles.stats}
              >
                <div className={styles.mainStat}>{props.stat}</div>
                {props.miniStat && (
                  <div className={styles.miniStat}>{props.miniStat}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className={styles.dualHeader}>
                <span>{props.header1}</span>
                <span>{props.header2}</span>
              </h2>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <div className={styles.mainStat}>{props.stat1}</div>
                  {props.miniStat1 && (
                    <div className={styles.miniStat}>{props.miniStat1}</div>
                  )}
                </div>
                <div className={styles.stat}>
                  {props.miniStat2 && (
                    <div className={styles.miniStat}>{props.miniStat2}</div>
                  )}
                  <div className={styles.mainStat}>{props.stat2}</div>
                </div>
              </div>
            </>
          )}
        </div>
        {children && <div className={styles.bottom}>{children}</div>}
      </div>
    </Card>
  );
};
