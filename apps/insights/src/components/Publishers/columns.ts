import type { ColumnConfig } from "@pythnetwork/component-library/Table";

export const columns = [
  { id: "rank", name: "RANKING", loadingSkeletonWidth: 10 },
  {
    id: "name",
    name: "NAME / ID",
    isRowHeader: true,
    fill: true,
    alignment: "left",
    loadingSkeletonWidth: 48,
  },
  {
    id: "activeFeeds",
    name: "ACTIVE FEEDS",
    alignment: "center",
    loadingSkeletonWidth: 6,
  },
  {
    id: "inactiveFeeds",
    name: "INACTIVE FEEDS",
    alignment: "center",
    loadingSkeletonWidth: 6,
  },
  {
    id: "score",
    name: "SCORE",
    loadingSkeletonWidth: 6,
  },
] satisfies ColumnConfig<string>[];
