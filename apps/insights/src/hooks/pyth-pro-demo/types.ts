import type { useWebSocket } from "@pythnetwork/react-hooks/use-websocket";
import type { Nullish } from "@pythnetwork/shared-lib/types";

import type {
  AllAllowedSymbols,
  AllDataSourcesType,
} from "../../schemas/pyth/pyth-pro-demo-schema";

export type UseDataStreamOpts = {
  dataSource: AllDataSourcesType;
  enabled: boolean;
  symbol: Nullish<AllAllowedSymbols>;
};

export type UseHttpDataStreamOpts = Omit<UseDataStreamOpts, "dataSource"> & {
  dataSources: AllDataSourcesType[];
};

export type UseDataStreamReturnType = Pick<
  ReturnType<typeof useWebSocket>,
  "status"
>;

export type UseHttpDataStreamReturnType = UseDataStreamReturnType & {
  error: Nullish<Error>;
};
