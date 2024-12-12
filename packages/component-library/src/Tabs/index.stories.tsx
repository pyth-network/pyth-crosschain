import type { Meta, StoryObj } from "@storybook/react";

import { Tabs as TabsComponent } from "./index.js";
import { UnstyledTabs } from "../UnstyledTabs/index.js";

const meta = {
  component: TabsComponent,
  argTypes: {
    items: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof TabsComponent>;
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
} satisfies StoryObj<typeof TabsComponent>;
