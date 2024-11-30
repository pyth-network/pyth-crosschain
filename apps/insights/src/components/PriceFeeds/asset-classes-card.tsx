"use client";

import { Badge } from "@pythnetwork/component-library/Badge";
import {
  CLOSE_DURATION_IN_MS,
  Drawer,
  DrawerTrigger,
} from "@pythnetwork/component-library/Drawer";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { Table } from "@pythnetwork/component-library/Table";
import { usePathname } from "next/navigation";
import { createSerializer } from "nuqs";
import { Suspense, use, useMemo } from "react";
import { useCollator } from "react-aria";

import styles from "./asset-classes-card.module.scss";
import { queryParams, useQuery } from "./use-query";

type Props = {
  numFeedsByAssetClassPromise: Promise<Record<string, number>>;
};

export const AssetClassesCard = ({ numFeedsByAssetClassPromise }: Props) => (
  <Suspense
    fallback={
      <StatCard stat={<Skeleton width={10} />} {...sharedStatCardProps} />
    }
  >
    <ResolvedAssetClassesCard
      numFeedsByAssetClassPromise={numFeedsByAssetClassPromise}
    />
  </Suspense>
);

const ResolvedAssetClassesCard = ({ numFeedsByAssetClassPromise }: Props) => {
  const numFeedsByAssetClass = use(numFeedsByAssetClassPromise);
  const numAssetClasses = useMemo(
    () => Object.keys(numFeedsByAssetClass).length,
    [numFeedsByAssetClass],
  );

  return (
    <DrawerTrigger>
      <StatCard stat={numAssetClasses} {...sharedStatCardProps} />
      <Drawer
        title={
          <div className={styles.drawerTitle}>
            <span>Asset Classes</span>
            <Badge>{numAssetClasses}</Badge>
          </div>
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

const sharedStatCardProps = {
  header: "Asset Classes",
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
  const { updateAssetClass } = useQuery();
  const assetClassRows = useMemo(
    () =>
      Object.entries(numFeedsByAssetClass)
        .sort(([a], [b]) => collator.compare(a, b))
        .map(([assetClass, count]) => {
          const serialize = createSerializer(queryParams);
          return {
            id: assetClass,
            href: `${pathname}${serialize({ assetClass })}`,
            onAction: () => {
              closeDrawer();
              setTimeout(() => {
                updateAssetClass(assetClass);
              }, CLOSE_DURATION_IN_MS);
            },
            data: {
              assetClass,
              count: <Badge style="outline">{count}</Badge>,
            },
          };
        }),
    [numFeedsByAssetClass, collator, closeDrawer, pathname, updateAssetClass],
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
