import type { Meta, StoryObj } from "@storybook/react";

import { TabList as TabListComponent } from "./index.jsx";
import { Tabs as UnstyledTabs } from "../unstyled/Tabs/index.jsx";

const meta = {
  title: "navigation & menus/TabList",
  component: TabListComponent,
  argTypes: {
    items: {
      table: {
        disable: true,
      },
    },
    currentTab: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof TabListComponent>;
export default meta;

export const TabList = {
  decorators: [
    (Story) => (
      <UnstyledTabs>
        <Story />
      </UnstyledTabs>
    ),
  ],
  args: {
    label: "Tab List",
    items: [
      { id: "btc", children: "BTC" },
      { id: "eth", children: "ETH" },
      { id: "sol", children: "SOL" },
    ],
  },
} satisfies StoryObj<typeof TabListComponent>;
