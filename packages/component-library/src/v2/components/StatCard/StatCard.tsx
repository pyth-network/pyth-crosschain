import cx from "clsx";

import { classes } from "./StatCard.styles";
import type { StatCardProps } from "./types";

export function StatCard({
  className,
  children,
  variant = "secondary",
  ...props
}: StatCardProps) {
  const isSingle = "header" in props;

  return (
    <div className={cx(classes.root, className)} data-variant={variant}>
      <div className={classes.cardContents}>
        <div className={classes.top}>
          {isSingle ? (
            <>
              {props.corner && (
                <div className={classes.corner}>{props.corner}</div>
              )}
              <h2 className={classes.header}>{props.header}</h2>
              <div
                className={classes.stats}
                data-small={props.small ? "true" : undefined}
              >
                <div className={classes.mainStat}>{props.stat}</div>
                {props.miniStat && (
                  <div className={classes.miniStat}>{props.miniStat}</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={classes.dualHeader}>
                <h2 className={classes.header}>{props.header1}</h2>
                <h2 className={classes.header}>{props.header2}</h2>
              </div>
              <div className={classes.stats}>
                <div className={classes.stat}>
                  <div className={classes.mainStat}>{props.stat1}</div>
                  {props.miniStat1 && (
                    <div className={classes.miniStat}>{props.miniStat1}</div>
                  )}
                </div>
                <div className={classes.stat}>
                  {props.miniStat2 && (
                    <div className={classes.miniStat}>{props.miniStat2}</div>
                  )}
                  <div className={classes.mainStat}>{props.stat2}</div>
                </div>
              </div>
            </>
          )}
        </div>
        {children && <div className={classes.bottom}>{children}</div>}
      </div>
    </div>
  );
}

export type { StatCardProps } from "./types";
