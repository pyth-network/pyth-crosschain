import type { Meta, StoryObj } from "@storybook/react";

import { TabList as TabListComponent } from "./index.jsx";
import { Tabs as UnstyledTabs } from "../unstyled/Tabs/index.jsx";

const meta = {
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
      { id: "foo", children: "Foo" },
      { id: "bar", children: "Bar" },
    ],
  },
} satisfies StoryObj<typeof TabListComponent>;
