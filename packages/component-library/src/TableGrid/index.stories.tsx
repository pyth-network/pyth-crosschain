import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../Badge";
import { dummyRowData } from "./dummy-row-data";
import { TableGrid as TableGridComponent } from "./index.jsx";

const meta = {
  component: TableGridComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    columns: {
      table: {
        disable: true,
      },
    },
    rows: {
      table: {
        disable: true,
      },
    },
    renderEmptyState: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    label: {
      table: {
        category: "Accessibility",
      },
    },
    isUpdating: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isLoading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    fill: {
      control: "boolean",
      table: {
        category: "Variant",
      },
    },
    rounded: {
      control: "boolean",
      table: {
        category: "Variant",
      },
    },
    dependencies: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof TableGridComponent>;
export default meta;

const args = {
  colDefs: [
    {
      headerName: "ID",
      field: "id",
    },
    {
      headerName: "PRICE FEED",
      field: "feed",
    },
    {
      headerName: "PRICE",
      field: "price",
      flex: 2,
      loadingSkeletonWidth: 30,
    },
    {
      headerName: "CONFIDENCE",
      field: "confidence",
      loadingSkeletonWidth: 20,
    },
  ],
  rowData: dummyRowData,
};

export const TableGrid = {
  args,
} satisfies StoryObj<typeof TableGridComponent>;

export const PriceFeedsCard = {
  render: (props) => {
    return <TableGridComponent {...props} />;
  },
  args: {
    ...args,
    pagination: true,
    cardProps: {
      icon: <ChartLine />,
      title: (
        <>
          <span>Price Feeds</span>
          <Badge style="filled" variant="neutral" size="md">
            {args.rowData.length}
          </Badge>
        </>
      ),
    },
  },
} satisfies StoryObj<typeof TableGridComponent>;
