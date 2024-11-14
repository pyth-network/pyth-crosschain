export const columns = [
  { id: "rank" as const, name: "RANKING" },
  {
    id: "name" as const,
    name: "NAME / ID",
    isRowHeader: true,
    fill: true,
    alignment: "left" as const,
  },
  {
    id: "activeFeeds" as const,
    name: "ACTIVE FEEDS",
    alignment: "left" as const,
  },
  {
    id: "inactiveFeeds" as const,
    name: "INACTIVE FEEDS",
    alignment: "left" as const,
  },
  { id: "score" as const, name: "SCORE" },
];
