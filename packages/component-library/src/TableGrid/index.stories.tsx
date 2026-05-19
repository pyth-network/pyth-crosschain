import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../Badge";
import { SymbolPairTag } from "../SymbolPairTag";
import { dummyRowData } from "./dummy-row-data";
import { TableGrid as TableGridComponent } from "./index.jsx";

const meta = {
  argTypes: {
    cardProps: {
      table: {
        category: "Outer Card",
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    columnDefs: {
      table: {
        disable: true,
      },
    },
    loading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    rowData: {
      table: {
        disable: true,
      },
    },
  },
  component: TableGridComponent,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TableGridComponent>;
export default meta;

const PriceCellRenderer = ({ value }: { value: number }) => (
  <span style={{ alignItems: "center", display: "flex", height: "100%" }}>
    {`$${value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`}
  </span>
);

const ConfidenceCellRenderer = ({ value }: { value: number }) => (
  <span
    style={{ alignItems: "center", display: "flex", height: "100%" }}
  >{`+/- ${value.toFixed(2)}%`}</span>
);

const FeedCellRenderer = ({ value }: { value: string }) => (
  <div style={{ alignItems: "center", display: "flex", height: "100%" }}>
    <SymbolPairTag description={value} displaySymbol={value} icon={undefined} />
  </div>
);

const FeedCellRendererLoading = () => (
  <div style={{ alignItems: "center", display: "flex", height: "100%" }}>
    <SymbolPairTag isLoading />
  </div>
);

const args = {
  columnDefs: [
    {
      field: "id",
      headerName: "ID",
    },
    {
      cellRenderer: FeedCellRenderer,
      field: "feed",
      flex: 2,
      headerName: "PRICE FEED",
      loadingCellRenderer: FeedCellRendererLoading,
    },
    {
      cellRenderer: PriceCellRenderer,
      field: "price",
      flex: 3,
      headerName: "PRICE",
    },
    {
      cellRenderer: ConfidenceCellRenderer,
      field: "confidence",
      headerName: "CONFIDENCE",
    },
  ],
  rowData: dummyRowData,
  rowHeight: 70,
};

export const TableGrid = {
  args,
} satisfies StoryObj<typeof TableGridComponent>;

export const PriceFeedsCard = {
  args: {
    ...args,
    cardProps: {
      icon: <ChartLine />,
      title: (
        <>
          <span>Price Feeds</span>
          <Badge size="md" style="filled" variant="neutral">
            {args.rowData.length}
          </Badge>
        </>
      ),
    },
    pagination: true,
  },
  render: (props) => {
    return <TableGridComponent {...props} />;
  },
} satisfies StoryObj<typeof TableGridComponent>;
