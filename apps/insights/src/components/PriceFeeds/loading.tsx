import { ChartLine } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@pythnetwork/component-library/Card";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { Table } from "@pythnetwork/component-library/Table";

import { columns } from "./columns";

export const PriceFeedsLoading = () => (
  <Card
    header={
      <div className="flex flex-row items-center gap-3">
        <ChartLine className="size-6 text-violet-600" />
        <div>Price Feeds</div>
      </div>
    }
    full
  >
    <Table
      label="Publishers"
      columns={columns}
      rows={[
        {
          id: 1,
          data: {
            asset: (
              <div className="mr-6">
                <Skeleton className="w-28" />
              </div>
            ),
            assetType: <Skeleton className="w-20" />,
            price: <Skeleton className="w-20" />,
            uptime: <Skeleton className="w-6" />,
            deviation: <Skeleton className="w-6" />,
            staleness: <Skeleton className="w-6" />,
          },
        },
      ]}
    />
  </Card>
);
