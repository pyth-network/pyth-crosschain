"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import { Table } from "@pythnetwork/component-library/Table";
import { useDrawer } from "@pythnetwork/component-library/useDrawer";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import {
  createSerializer,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "@pythnetwork/react-hooks/nuqs";
import { usePathname } from "next/navigation";
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
    assetClass: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
    search: parseAsString.withDefault(""),
  };
  const serialize = createSerializer(queryStates);
  const [, setQuery] = useQueryStates(queryStates);
  const assetClassRows = useMemo(
    () =>
      Object.entries(numFeedsByAssetClass)
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([assetClass, count]) => {
          const newQuery = { assetClass, page: 1, search: "" };
          return {
            data: {
              assetClass,
              count: <Badge style="outline">{count}</Badge>,
            },
            href: `${pathname}${serialize(newQuery)}`,
            id: assetClass,
            onAction: () => {
              drawer.close().catch((error: unknown) => {
                logger.error(error);
              });
              setQuery(newQuery).catch((error: unknown) => {
                logger.error("Failed to update query", error);
              });
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
      columns={[
        {
          alignment: "left",
          fill: true,
          id: "assetClass",
          isRowHeader: true,
          name: "ASSET CLASS",
        },
        { alignment: "center", id: "count", name: "COUNT" },
      ]}
      fill
      label="Asset Classes"
      rows={assetClassRows}
      stickyHeader="top"
    />
  );
};
