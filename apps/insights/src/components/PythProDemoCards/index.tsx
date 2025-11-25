import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";

import { PriceCard } from "./price-card";
import {
  usePythProAppStateContext,
  useWebSocketsContext,
} from "../../context/pyth-pro-demo";

export function PriceCards() {
  /** context */
  const { dataSourcesInUse, metrics, selectedSource } =
    usePythProAppStateContext();
  const { statuses } = useWebSocketsContext();

  if (isNullOrUndefined(selectedSource)) return;

  return (
    <div>
      {dataSourcesInUse.map((dataSource) => {
        const sourceMetrics = metrics[dataSource]?.latest;
        const socketStatus = statuses[dataSource];

        return (
          <PriceCard
            currentPriceMetrics={sourceMetrics?.[selectedSource]}
            dataSource={dataSource}
            selectedSource={selectedSource}
            socketStatus={socketStatus}
            key={dataSource}
          />
        );
      })}
    </div>
  );
}
