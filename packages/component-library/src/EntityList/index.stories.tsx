import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../Badge/index.jsx";
import { EntityList as EntityListComponent } from "./index.jsx";

const meta = {
  component: EntityListComponent,
  argTypes: {
    label: {
      control: "text",
      description: "Aria label for the list",
      table: {
        category: "Accessibility",
      },
    },
    isLoading: {
      control: "boolean",
      description: "Show loading state",
      table: {
        category: "State",
      },
    },
    onSelectionChange: {
      action: "selectionChanged",
      table: {
        category: "Events",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof EntityListComponent>;
export default meta;

type Story = StoryObj<typeof EntityListComponent>;

const defaultFields = [
  { id: "name" as const, name: "Name" },
  { id: "status" as const, name: "Status" },
  { id: "price" as const, name: "Price" },
  { id: "change" as const, name: "24h Change" },
];

const sampleRows = [
  {
    id: "1",
    textValue: "Bitcoin",
    data: {
      name: "Bitcoin",
      status: <Badge variant="success">Active</Badge>,
      price: "$45,234.56",
      change: "+2.34%",
    },
  },
  {
    id: "2",
    textValue: "Ethereum",
    data: {
      name: "Ethereum",
      status: <Badge variant="success">Active</Badge>,
      price: "$3,234.56",
      change: "-1.23%",
    },
  },
  {
    id: "3",
    textValue: "Solana",
    data: {
      name: "Solana",
      status: <Badge variant="success">Active</Badge>,
      price: "$123.45",
      change: "+5.67%",
    },
  },
];

export const Default: Story = {
  args: {
    label: "Cryptocurrency list",
    fields: defaultFields,
    rows: sampleRows,
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    label: "Cryptocurrency list",
    fields: [
      { id: "name" as const, name: "Name", loadingSkeletonWidth: 80 },
      { id: "status" as const, name: "Status", loadingSkeletonWidth: 60 },
      { id: "price" as const, name: "Price", loadingSkeletonWidth: 100 },
      { id: "change" as const, name: "24h Change", loadingSkeletonWidth: 70 },
    ],
    isLoading: true,
  },
};

export const WithHeaders: Story = {
  args: {
    label: "Price feeds",
    fields: [
      { id: "symbol" as const, name: "Symbol" },
      { id: "confidence" as const, name: "Confidence" },
      { id: "price" as const, name: "Price" },
    ],
    rows: [
      {
        id: "btc-usd",
        textValue: "BTC/USD",
        header: <h3>BTC/USD</h3>,
        data: {
          symbol: "BTC/USD",
          confidence: "±$12.34",
          price: "$45,234.56",
        },
      },
      {
        id: "eth-usd",
        textValue: "ETH/USD",
        header: <h3>ETH/USD</h3>,
        data: {
          symbol: "ETH/USD",
          confidence: "±$2.34",
          price: "$3,234.56",
        },
      },
    ],
  },
};

export const WithLinks: Story = {
  args: {
    label: "Blockchain networks",
    fields: [
      { id: "network" as const, name: "Network" },
      { id: "chainId" as const, name: "Chain ID" },
      { id: "rpc" as const, name: "RPC" },
    ],
    rows: [
      {
        id: "ethereum",
        textValue: "Ethereum",
        href: "#ethereum",
        data: {
          network: "Ethereum",
          chainId: "1",
          rpc: "https://eth.example.com",
        },
      },
      {
        id: "polygon",
        textValue: "Polygon",
        href: "#polygon",
        data: {
          network: "Polygon",
          chainId: "137",
          rpc: "https://polygon.example.com",
        },
      },
    ],
  },
};

export const SingleRow: Story = {
  args: {
    label: "Single item list",
    fields: [
      { id: "key" as const, name: "Key" },
      { id: "value" as const, name: "Value" },
    ],
    rows: [
      {
        id: "single",
        textValue: "Configuration",
        data: {
          key: "API_ENDPOINT",
          value: "https://api.example.com",
        },
      },
    ],
  },
};

export const ComplexContent: Story = {
  args: {
    label: "Complex content list",
    fields: [
      { id: "project" as const, name: "Project" },
      { id: "metrics" as const, name: "Metrics" },
      { id: "actions" as const, name: "Actions" },
    ],
    rows: [
      {
        id: "project-1",
        textValue: "Project Alpha",
        data: {
          project: <strong>Project Alpha</strong>,
          metrics: (
            <div style={{ display: "flex", gap: "8px" }}>
              <Badge variant="neutral">10 feeds</Badge>
              <Badge variant="success">98% uptime</Badge>
            </div>
          ),
          actions: (
            <div style={{ display: "flex", gap: "8px" }}>
              <button>Edit</button>
              <button>Delete</button>
            </div>
          ),
        },
      },
      {
        id: "project-2",
        textValue: "Project Beta",
        data: {
          project: <strong>Project Beta</strong>,
          metrics: (
            <div style={{ display: "flex", gap: "8px" }}>
              <Badge variant="neutral">5 feeds</Badge>
              <Badge variant="warning">92% uptime</Badge>
            </div>
          ),
          actions: (
            <div style={{ display: "flex", gap: "8px" }}>
              <button>Edit</button>
              <button>Delete</button>
            </div>
          ),
        },
      },
    ],
  },
};