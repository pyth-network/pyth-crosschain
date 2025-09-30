import type { ColumnConfig } from "@pythnetwork/component-library/Table";

type Col =
  | "assetType"
  | "description"
  | "name"
  | "symbol"
  | "proId"
  | "exponent";

export const PRICE_FEEDS_PRO_API_URL =
  "https://history.pyth-lazer.dourolabs.app/history/v1/symbols";

export const PRICE_FEEDS_PRO_COLUMNS: ColumnConfig<Col>[] = [
  { id: "assetType", name: "Asset Type", isRowHeader: true },
  { id: "description", name: "Description" },
  { id: "name", name: "Name" },
  { id: "symbol", name: "Symbol" },
  { id: "proId", name: "Pyth Pro Id" },
  { id: "exponent", name: "Exponent" },
];
