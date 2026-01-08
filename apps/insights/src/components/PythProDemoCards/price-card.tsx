import { Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import type { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { capitalCase } from "change-case";
import cx from "clsx";
import { useEffect, useState } from "react";

import { PriceCardUtils } from "./price-card-utils";
import classes from "./price-card.module.scss";
import type {
  AllAllowedSymbols,
  AllDataSourcesType,
  CurrentPriceMetrics,
} from "../../schemas/pyth/pyth-pro-demo-schema";
import { removeReplaySymbolSuffix } from "../../schemas/pyth/pyth-pro-demo-schema";
import {
  datasourceRequiresApiToken,
  getColorForDataSource,
  isAllowedCryptoSymbol,
  isAllowedEquitySymbol,
  isAllowedForexSymbol,
  isAllowedSymbol,
  isReplaySymbol,
} from "../../util/pyth-pro-demo";
import { PriceCard } from "../PriceCard";

function transformDataSourceName(dataSource: AllDataSourcesType) {
  if (dataSource === "nbbo") return dataSource.toUpperCase();
  return capitalCase(dataSource);
}

type PriceCardProps = {
  apiToken: Nullish<string>;
  currentPriceMetrics: Nullish<CurrentPriceMetrics>;
  dataSource: AllDataSourcesType;
  selectedSource: Nullish<AllAllowedSymbols>;
  socketStatus: Nullish<ReturnType<typeof useWebSocket>["status"]>;
  sourceVisible: boolean;
  toggleDataSourceVisibility: (dataSource: AllDataSourcesType) => void;
};

export function PythProDemoCard({
  apiToken,
  currentPriceMetrics,
  dataSource,
  selectedSource,
  socketStatus,
  sourceVisible,
  toggleDataSourceVisibility,
}: PriceCardProps) {
  if (!isAllowedSymbol(selectedSource)) return;

  /** local variables */
  const requiresToken = datasourceRequiresApiToken(dataSource);

  const toggleVisibilityTooltip = `${sourceVisible ? "Hide" : "Show"} this data source in the chart`;
  const formattedSymbol =
    removeReplaySymbolSuffix(selectedSource).toUpperCase();
  const formattedDataSource = transformDataSourceName(dataSource);
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
        <span
          className={classes.dataSourceName}
          style={{ color: getColorForDataSource(dataSource) }}
        >
          <Button
            aria-label={toggleVisibilityTooltip}
            className={classes.toggleVisibilityBtn ?? ""}
            onPress={() => {
              toggleDataSourceVisibility(dataSource);
            }}
            size="sm"
            variant="ghost"
          >
            {sourceVisible ? <Eye /> : <EyeSlash />}
          </Button>
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
            {!isReplaySymbol(selectedSource) &&
            requiresToken &&
            !apiToken &&
            socketStatus === "closed" ? (
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

export function PythProDemoCard2({
  apiToken,
  currentPriceMetrics,
  dataSource,
  selectedSource,
  socketStatus,
}: PriceCardProps) {
  /** state */
  const [cardRef, setCardRef] = useState<Nullish<HTMLDivElement>>(undefined);

  /** effects */
  useEffect(() => {
    const nameElem: Nullish<HTMLElement> =
      cardRef?.querySelector("[data-symbolname]");

    if (!nameElem) return;

    nameElem.style.color = getColorForDataSource(dataSource);
  }, [cardRef, dataSource]);

  /** local variables */
  const formattedDataSource = transformDataSourceName(dataSource);
  const requiresToken = datasourceRequiresApiToken(dataSource);
  let assetClass = "";

  /**
   * these values were determined by looking at the source in
   * apps/insights/src/components/PriceFeedIcon/index.tsx
   */
  if (isAllowedCryptoSymbol(selectedSource)) {
    assetClass = "Crypto";
  } else if (isAllowedEquitySymbol(selectedSource)) {
    assetClass = "Equity";
  } else if (isAllowedForexSymbol(selectedSource)) {
    assetClass = "FX";
  }

  if (!isAllowedSymbol(selectedSource)) return;

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
    <PriceCard
      assetClass={assetClass}
      className={cx(classes.root)}
      description={selectedSource.toUpperCase()}
      displaySymbol={formattedDataSource}
      ref={setCardRef}
    >
      <div className={classes.priceInfo}>
        <div className={classes.price}>
          {socketStatus === "connected" &&
            PriceCardUtils.formatPrice(currentPriceMetrics?.price)}
        </div>
        <div className={cx(classes.priceChange, priceChangeClassName)}>
          {socketStatus === "connected" &&
            PriceCardUtils.formatChange(
              currentPriceMetrics?.change,
              currentPriceMetrics?.changePercent,
            )}
        </div>
        <div className={classes.socketStatus}>
          {!isReplaySymbol(selectedSource) && requiresToken && !apiToken ? (
            <>
              {/* the token is either missing or it's a bad token */}
              Please enter a good API token
              <br />
              to continue with {formattedDataSource}
            </>
          ) : (
            capitalCase(socketStatus ?? "closed")
          )}
        </div>
      </div>
    </PriceCard>
  );
}
