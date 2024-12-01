import { Card } from "@pythnetwork/component-library/Card";
import { Table } from "@pythnetwork/component-library/Table";

import { columns } from "./columns";

export const PublishersLoading = () => (
  <Card title="Publishers">
    <Table label="Publishers" columns={columns} isLoading />
  </Card>
);
