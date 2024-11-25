import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { TableCard } from "@pythnetwork/component-library/TableCard";

import { columns } from "./columns";

export const PriceFeedsLoading = () => (
  <TableCard
    label="Price Feeds"
    icon={ChartLine}
    columns={columns}
    isLoading={true}
    rows={[]}
  />
);
