export const columns = [
  {
    id: "asset" as const,
    name: "ASSET",
    isRowHeader: true,
    alignment: "left" as const,
  },
  {
    id: "assetType" as const,
    name: "ASSET TYPE",
    fill: true,
    alignment: "left" as const,
  },
  { id: "price" as const, name: "PRICE", alignment: "right" as const },
  { id: "uptime" as const, name: "UPTIME", alignment: "center" as const },
  { id: "deviation" as const, name: "DEVIATION", alignment: "center" as const },
  { id: "staleness" as const, name: "STALENESS", alignment: "center" as const },
];
