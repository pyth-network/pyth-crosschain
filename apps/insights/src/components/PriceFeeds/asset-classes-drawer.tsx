"use client";

import { useLogger } from "@pythnetwork/app-logger";
import { Badge } from "@pythnetwork/component-library/Badge";
import {
  CLOSE_DURATION_IN_MS,
  Drawer,
  DrawerTrigger,
} from "@pythnetwork/component-library/Drawer";
import { Table } from "@pythnetwork/component-library/Table";
import { usePathname } from "next/navigation";
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
  createSerializer,
} from "nuqs";
import { type ReactNode, useMemo } from "react";
import { useCollator } from "react-aria";

type Props = {
  numFeedsByAssetClass: Record<string, number>;
  children: ReactNode;
};

export const AssetClassesDrawer = ({
  numFeedsByAssetClass,
  children,
}: Props) => {
  const numAssetClasses = useMemo(
    () => Object.keys(numFeedsByAssetClass).length,
    [numFeedsByAssetClass],
  );

  return (
    <DrawerTrigger>
      {children}
      <Drawer
        fill
        title={
          <>
            <span>Asset Classes</span>
            <Badge>{numAssetClasses}</Badge>
          </>
        }
      >
        {({ state }) => (
          <AssetClassTable
            numFeedsByAssetClass={numFeedsByAssetClass}
            state={state}
          />
        )}
      </Drawer>
    </DrawerTrigger>
  );
};

type AssetClassTableProps = {
  numFeedsByAssetClass: Record<string, number>;
  state: { close: () => void };
};

const AssetClassTable = ({
  numFeedsByAssetClass,
  state,
}: AssetClassTableProps) => {
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
              state.close();
              setTimeout(() => {
                setQuery(newQuery).catch((error: unknown) => {
                  logger.error("Failed to update query", error);
                });
              }, CLOSE_DURATION_IN_MS);
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
      state,
      pathname,
      setQuery,
      serialize,
      logger,
    ],
  );
  return (
    <Table
      fill
      stickyHeader
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
