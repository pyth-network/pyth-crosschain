import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { Table } from "@pythnetwork/component-library/Table";

import { columns } from "./columns";

export const PublishersLoading = () => (
  <Table
    label="Publishers"
    columns={columns}
    rows={[
      {
        id: 1,
        data: {
          activeFeeds: <Skeleton className="w-6" />,
          inactiveFeeds: <Skeleton className="w-6" />,
          name: <Skeleton className="w-48" />,
          rank: <Skeleton className="w-10" />,
          score: <Skeleton className="w-6" />,
        },
      },
    ]}
  />
);
