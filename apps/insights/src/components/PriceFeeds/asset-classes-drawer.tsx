"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import {
  CLOSE_DURATION_IN_MS,
  Drawer,
  DrawerTrigger,
} from "@pythnetwork/component-library/Drawer";
import { Table } from "@pythnetwork/component-library/Table";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import { useCollator } from "react-aria";

import { serialize, useQueryParams } from "./query-params";

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
        title={
          <>
            <span>Asset Classes</span>
            <Badge>{numAssetClasses}</Badge>
          </>
        }
      >
        {({ close }) => (
          <AssetClassTable
            numFeedsByAssetClass={numFeedsByAssetClass}
            closeDrawer={close}
          />
        )}
      </Drawer>
    </DrawerTrigger>
  );
};

type AssetClassTableProps = {
  numFeedsByAssetClass: Record<string, number>;
  closeDrawer: () => void;
};

const AssetClassTable = ({
  numFeedsByAssetClass,
  closeDrawer,
}: AssetClassTableProps) => {
  const collator = useCollator();
  const pathname = usePathname();
  const { updateAssetClass, updateSearch } = useQueryParams();
  const assetClassRows = useMemo(
    () =>
      Object.entries(numFeedsByAssetClass)
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([assetClass, count]) => ({
          id: assetClass,
          href: `${pathname}${serialize({ assetClass })}`,
          onAction: () => {
            closeDrawer();
            setTimeout(() => {
              updateAssetClass(assetClass);
              updateSearch("");
            }, CLOSE_DURATION_IN_MS);
          },
          data: {
            assetClass,
            count: <Badge style="outline">{count}</Badge>,
          },
        })),
    [
      numFeedsByAssetClass,
      collator,
      closeDrawer,
      pathname,
      updateAssetClass,
      updateSearch,
    ],
  );
  return (
    <Table
      fill
      divide
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
