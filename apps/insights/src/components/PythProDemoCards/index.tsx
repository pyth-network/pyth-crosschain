import { EmptyState } from "./empty-state";
import { PythProDemoCard } from "./price-card";
import {
  usePythProAppStateContext,
  useWebSocketsContext,
} from "../../context/pyth-pro-demo";
import { isAllowedSymbol } from "../../util/pyth-pro-demo";

export function PythProDemoCards() {
  /** context */
  const { dataSourcesInUse, metrics, selectedSource } =
    usePythProAppStateContext();
  const { statuses } = useWebSocketsContext();

  if (!isAllowedSymbol(selectedSource)) {
    return <EmptyState />;
  }

  return (
    <div>
      {dataSourcesInUse.map((dataSource) => {
        const sourceMetrics = metrics[dataSource]?.latest;
        const socketStatus = statuses[dataSource];

        return (
          <PythProDemoCard
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
