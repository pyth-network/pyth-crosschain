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

export type PythProDemoQueryParams = {
  /**
   * like the cassette players from a bygone era,
   * this controls how fast the historical data playback
   * "streams" into view (only affects historical replay symbols)
   */
  playbackSpeed: number;

  /**
   * the symbol a user has selected to visualize
   */
  selectedSource: AllAllowedSymbols;

  /**
   * ISO-8061 timestamp for the time a user selected to start querying
   * (only affects historical replay symbols)
   */
  startAt: string;
};
