import type { Meta, StoryObj } from "@storybook/react";

import { AppTabs as AppTabsComponent } from "./index.js";
import { UnstyledTabs } from "../UnstyledTabs/index.js";

const meta = {
  component: AppTabsComponent,
  argTypes: {
    tabs: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof AppTabsComponent>;
export default meta;

export const AppTabs = {
  decorators: [
    (Story) => (
      <UnstyledTabs>
        <Story />
      </UnstyledTabs>
    ),
  ],
  args: {
    tabs: [
      { id: "foo", children: "Foo" },
      { id: "bar", children: "Bar" },
    ],
  },
} satisfies StoryObj<typeof AppTabsComponent>;
