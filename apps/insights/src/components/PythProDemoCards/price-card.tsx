import { Card } from "@pythnetwork/component-library/Card";
import type { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";
import cx from "clsx";

import { PriceCardUtils } from "./price-card-utils";
import classes from "./price-card.module.scss";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  CurrentPriceMetrics,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { getColorForSymbol, isAllowedSymbol } from "../../util/pyth-pro-demo";

type PriceCardProps = {
  currentPriceMetrics: Nullish<CurrentPriceMetrics>;
  dataSource: AllDataSourcesType;
  selectedSource: Nullish<AllAllowedSymbols>;
  socketStatus: Nullish<ReturnType<typeof useWebSocket>["status"]>;
};

export function PythProDemoCard({
  currentPriceMetrics,
  dataSource,
  selectedSource,
  socketStatus,
}: PriceCardProps) {
  if (!isAllowedSymbol(selectedSource)) return;

  /** local variables */
  const formattedSourceType = selectedSource.toUpperCase();
  let priceChangeClassName = "";

  if (!isNullOrUndefined(currentPriceMetrics?.change)) {
    const { change } = currentPriceMetrics;
    if (change < 0) {
      priceChangeClassName = classes.priceDropping;
    } else if (change > 0) {
      priceChangeClassName = classes.priceIncreasing;
    }
  }

  return (
    <Card
      className={classes.root}
      nonInteractive
      title={
        <span style={{ color: getColorForSymbol(dataSource) }}>
          {capitalCase(dataSource)}
        </span>
      }
      variant="secondary"
    >
      <div className={classes.cardContents}>
        {socketStatus === "connected" && (
          <>
            <div className={classes.price}>
              {PriceCardUtils.formatPrice(currentPriceMetrics?.price)}
            </div>
            <div className={priceChangeClassName}>
              {PriceCardUtils.formatChange(
                currentPriceMetrics?.change,
                currentPriceMetrics?.changePercent,
              )}
            </div>
          </>
        )}
        <div className={classes.symbol}>{formattedSourceType}</div>
        {socketStatus && (
          <div className={classes.socketStatus}>
            {capitalCase(socketStatus)}
          </div>
        )}
      </div>
    </Card>
  );
  // return (
  //   <Card
  //     className={classes.priceCard}
  //     key={dataSource}
  //     subTitle={
  //       <div className={classes.priceCardSubtitle}>
  //         <span>{formattedSourceType}</span>
  //         {socketStatus && <span>{capitalCase(socketStatus)}</span>}
  //       </div>
  //     }
  //     title={
  //       <span style={{ color: getColorForDataSource(dataSource) }}>
  //         {capitalCase(dataSource)}
  //       </span>
  //     }
  //   >
  //     {socketStatus === "connected" && (
  //       <>
  //         <div className={classes.priceCardPrice}>
  //           {PriceCardUtils.formatPrice(currentPriceMetrics?.price)}
  //         </div>
  //         <div
  //           className={
  //             isNullOrUndefined(currentPriceMetrics?.change)
  //               ? ""
  //               : cx(
  //                   currentPriceMetrics.change < 0
  //                     ? classes.priceDropping
  //                     : currentPriceMetrics.change > 0
  //                       ? classes.priceIncreasing
  //                       : null,
  //                 )
  //           }
  //         >
  //           {PriceCardUtils.formatChange(
  //             currentPriceMetrics?.change,
  //             currentPriceMetrics?.changePercent,
  //           )}
  //         </div>
  //       </>
  //     )}
  //   </Card>
  // );
}
