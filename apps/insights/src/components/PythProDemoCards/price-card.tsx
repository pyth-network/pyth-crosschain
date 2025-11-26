import { Card } from "@pythnetwork/component-library/Card";
import type { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";
import cx from "clsx";

import { PriceCardUtils } from "./price-card-utils";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  CurrentPriceMetrics,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { getColorForSymbol } from "../../util/pyth-pro-demo";

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
  if (isNullOrUndefined(selectedSource)) return;

  /** local variables */
  const formattedSourceType = selectedSource.toUpperCase();
  return (
    <Card
      nonInteractive
      title={
        <span style={{ color: getColorForSymbol(dataSource) }}>
          {capitalCase(dataSource)}
        </span>
      }
    >
      <div>
        <span>{formattedSourceType}</span>
        {socketStatus && <span>{capitalCase(socketStatus)}</span>}
        {socketStatus === "connected" && (
          <>
            <div>{PriceCardUtils.formatPrice(currentPriceMetrics?.price)}</div>
            <div
              className={
                isNullOrUndefined(currentPriceMetrics?.change) ? "" : cx()
                // currentPriceMetrics.change < 0
                //   ? classes.priceDropping
                //   : currentPriceMetrics.change > 0
                //     ? classes.priceIncreasing
                //     : null,
              }
            >
              {PriceCardUtils.formatChange(
                currentPriceMetrics?.change,
                currentPriceMetrics?.changePercent,
              )}
            </div>
          </>
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
