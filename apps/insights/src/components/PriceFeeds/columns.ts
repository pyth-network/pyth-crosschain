import type { ColumnConfig } from "@pythnetwork/component-library/Table";

export const columns = [
  {
    id: "asset",
    name: "ASSET",
    isRowHeader: true,
    alignment: "left",
    loadingSkeletonWidth: 28,
  },
  {
    id: "assetType",
    name: "ASSET TYPE",
    fill: true,
    alignment: "left",
    loadingSkeletonWidth: 20,
  },
  {
    id: "price",
    name: "PRICE",
    alignment: "right",
    loadingSkeletonWidth: 20,
  },
  {
    id: "uptime",
    name: "UPTIME",
    alignment: "center",
    loadingSkeletonWidth: 6,
  },
  {
    id: "deviation",
    name: "DEVIATION",
    alignment: "center",
    loadingSkeletonWidth: 6,
  },
  {
    id: "staleness",
    name: "STALENESS",
    alignment: "center",
    loadingSkeletonWidth: 6,
  },
] satisfies ColumnConfig<string>[];
