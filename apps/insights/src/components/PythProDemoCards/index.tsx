
import { useGetMetricsForDataSourceAndSymbol, useSelectedDataSources } from "../../hooks/pyth-pro-demo";

export function PriceCards() {
  /** store */
  const { dataSourcesInUse, selectedSource } = useSelectedDataSources();
  const { getMetricsForSourceAndSymbol } = useGetMetricsForDataSourceAndSymbol();
  const { statuses } = useWebSocketsContext();

  if (dataSourcesInUse.length <= 0) return;

  return (
    <div>
      {dataSourcesInUse.map((dataSource) => {
        const sourceMetrics = getMetricsForSourceAndSymbol(dataSource);
        const socketStatus = statuses[dataSource];

        return (
          <PriceCard
            currentPriceMetrics={sourceMetrics}
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