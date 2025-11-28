import { Card } from "@pythnetwork/component-library/Card";
import type { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";

import { PriceCardUtils } from "./price-card-utils";
import classes from "./price-card.module.scss";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  CurrentPriceMetrics,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  datasourceRequiresApiToken,
  getColorForSymbol,
  isAllowedSymbol,
} from "../../util/pyth-pro-demo";

type PriceCardProps = {
  apiToken: Nullish<string>;
  currentPriceMetrics: Nullish<CurrentPriceMetrics>;
  dataSource: AllDataSourcesType;
  selectedSource: Nullish<AllAllowedSymbols>;
  socketStatus: Nullish<ReturnType<typeof useWebSocket>["status"]>;
};

export function PythProDemoCard({
  apiToken,
  currentPriceMetrics,
  dataSource,
  selectedSource,
  socketStatus,
}: PriceCardProps) {
  if (!isAllowedSymbol(selectedSource)) return;

  /** local variables */
  const requiresToken = datasourceRequiresApiToken(dataSource);

  const formattedSymbol = selectedSource.toUpperCase();
  const formattedDataSource = capitalCase(dataSource);
  let priceChangeClassName: Nullish<string> = "";

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
          {formattedDataSource}
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
        <div className={classes.symbol}>{formattedSymbol}</div>
        {socketStatus && (
          <div className={classes.socketStatus}>
            {/* the token is either missing or it's a bad token */}
            {requiresToken && (!apiToken || socketStatus === "closed") ? (
              <>
                Please enter a good API token
                <br />
                to continue with {formattedDataSource}
              </>
            ) : (
              capitalCase(socketStatus)
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
