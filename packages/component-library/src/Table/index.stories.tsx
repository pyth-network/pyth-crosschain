import type { Meta, StoryObj } from "@storybook/react";

import { Table as TableComponent } from "./index.jsx";

const meta = {
  argTypes: {
    className: {
      table: {
        disable: true,
      },
    },
    columns: {
      table: {
        disable: true,
      },
    },
    dependencies: {
      table: {
        disable: true,
      },
    },
    fill: {
      control: "boolean",
      table: {
        category: "Variant",
      },
    },
    isLoading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isUpdating: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    label: {
      table: {
        category: "Accessibility",
      },
    },
    renderEmptyState: {
      table: {
        disable: true,
      },
    },
    rounded: {
      control: "boolean",
      table: {
        category: "Variant",
      },
    },
    rows: {
      table: {
        disable: true,
      },
    },
  },
  component: TableComponent,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TableComponent>;
export default meta;

export const Table = {
  args: {
    columns: [
      {
        id: "feed",
        isRowHeader: true,
        loadingSkeletonWidth: 16,
        name: "PRICE FEED",
      },
      {
        fill: true,
        id: "price",
        loadingSkeletonWidth: 30,
        name: "PRICE",
      },
      {
        alignment: "right",
        id: "confidence",
        loadingSkeletonWidth: 20,
        name: "CONFIDENCE",
      },
    ],
    fill: true,
    isLoading: false,
    isUpdating: false,
    label: "A Table",
    rounded: true,
    rows: [
      {
        data: {
          confidence: "+/- 5%",
          feed: "BTC/USD",
          price: "$100,000",
        },
        href: "#",
        id: "BTC/USD",
      },
      {
        data: {
          confidence: "+/- 10%",
          feed: "ETH/USD",
          price: "$1,000",
        },
        href: "#",
        id: "ETH/USD",
      },
      {
        data: {
          confidence: "+/- 0.1%",
          feed: "SOL/USD",
          price: "$1,000,000,000",
        },
        href: "#",
        id: "SOL/USD",
      },
    ],
  },
} satisfies StoryObj<typeof TableComponent>;
