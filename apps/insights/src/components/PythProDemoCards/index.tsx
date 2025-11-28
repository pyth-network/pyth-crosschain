import { EmptyState } from "./empty-state";
import classes from "./index.module.scss";
import { PythProDemoCard } from "./price-card";
import {
  usePythProApiTokensContext,
  usePythProAppStateContext,
  useWebSocketsContext,
} from "../../context/pyth-pro-demo";
import { isAllowedSymbol } from "../../util/pyth-pro-demo";

export function PythProDemoCards() {
  /** context */
  const { dataSourcesInUse, metrics, selectedSource } =
    usePythProAppStateContext();
  const { tokens } = usePythProApiTokensContext();
  const { statuses } = useWebSocketsContext();

  if (!isAllowedSymbol(selectedSource)) {
    return <EmptyState />;
  }

  return (
    <div className={classes.root}>
      {dataSourcesInUse.map((dataSource) => {
        const sourceMetrics = metrics[dataSource]?.latest;
        const socketStatus = statuses[dataSource];

        return (
          <PythProDemoCard
            apiToken={tokens[dataSource]}
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
