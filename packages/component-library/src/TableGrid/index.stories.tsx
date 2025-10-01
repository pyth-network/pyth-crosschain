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
    colDefs: {
      table: {
        disable: true,
      },
    },
    rowData: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    cardProps: {
      table: {
        category: "Outer Card",
      },
    },
    isLoading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
  },
} satisfies Meta<typeof TableGridComponent>;
export default meta;

export const PriceCellRenderer = ({ value }: { value: number }) =>  (
    <span>
      {`$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`}
    </span>
  );

export const ConfidenceCellRenderer = ({ value }: { value: number }) =>  <span>{`+/- ${value.toFixed(2)}%`}</span>;

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
      cellRenderer: PriceCellRenderer,
    },
    {
      headerName: "CONFIDENCE",
      field: "confidence",
      cellRenderer: ConfidenceCellRenderer,
      context: {
        loadingSkeletonWidth: 20,
      }
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
