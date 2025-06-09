"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import { Table } from "@pythnetwork/component-library/Table";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { usePathname } from "next/navigation";
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
  createSerializer,
} from "nuqs";
import { useMemo } from "react";
import { useCollator } from "react-aria";

type Props = {
  numFeedsByAssetClass: Record<string, number>;
};

export const AssetClassTable = ({ numFeedsByAssetClass }: Props) => {
  const drawer = useDrawer();
  const logger = useLogger();
  const collator = useCollator();
  const pathname = usePathname();
  const queryStates = {
    page: parseAsInteger.withDefault(1),
    search: parseAsString.withDefault(""),
    assetClass: parseAsString.withDefault(""),
  };
  const serialize = createSerializer(queryStates);
  const [, setQuery] = useQueryStates(queryStates);
  const assetClassRows = useMemo(
    () =>
      Object.entries(numFeedsByAssetClass)
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([assetClass, count]) => {
          const newQuery = { assetClass, search: "", page: 1 };
          return {
            id: assetClass,
            href: `${pathname}${serialize(newQuery)}`,
            onAction: () => {
              drawer.close().catch((error: unknown) => {
                logger.error(error);
              });
              setQuery(newQuery).catch((error: unknown) => {
                logger.error("Failed to update query", error);
              });
            },
            data: {
              assetClass,
              count: <Badge style="outline">{count}</Badge>,
            },
          };
        }),
    [
      numFeedsByAssetClass,
      collator,
      drawer,
      pathname,
      setQuery,
      serialize,
      logger,
    ],
  );
  return (
    <Table
      fill
      stickyHeader="top"
      label="Asset Classes"
      columns={[
        {
          id: "assetClass",
          name: "ASSET CLASS",
          isRowHeader: true,
          fill: true,
          alignment: "left",
        },
        { id: "count", name: "COUNT", alignment: "center" },
      ]}
      rows={assetClassRows}
    />
  );
};
