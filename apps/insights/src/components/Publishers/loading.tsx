import { TableCard } from "@pythnetwork/component-library/TableCard";

import { columns } from "./columns";

export const PublishersLoading = () => (
  <TableCard label="Publishers" columns={columns} isLoading rows={[]} />
);
