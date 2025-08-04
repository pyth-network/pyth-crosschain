
import { getRankingsBySymbol } from "../services/clickhouse";

export const getRankingsBySymbolCached = async (symbol: string) => {
  "use cache";
  return getRankingsBySymbol(symbol);
};