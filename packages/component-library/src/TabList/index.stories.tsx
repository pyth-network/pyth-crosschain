import type { Meta, StoryObj } from "@storybook/react";

import { TabList as TabListComponent } from "./index.js";
import { Tabs as UnstyledTabs } from "../unstyled/Tabs/index.js";

const meta = {
  component: TabListComponent,
  argTypes: {
    items: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof TabListComponent>;
export default meta;

export const Tabs = {
  decorators: [
    (Story) => (
      <UnstyledTabs>
        <Story />
      </UnstyledTabs>
    ),
  ],
  args: {
    items: [
      { id: "foo", children: "Foo" },
      { id: "bar", children: "Bar" },
    ],
  },
} satisfies StoryObj<typeof TabListComponent>;
