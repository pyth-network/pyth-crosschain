import type { Meta, StoryObj } from "@storybook/react";

import { MainNavTabs as MainNavTabsComponent } from "./index.js";
import { UnstyledTabs } from "../UnstyledTabs/index.js";

const meta = {
  component: MainNavTabsComponent,
  argTypes: {
    items: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof MainNavTabsComponent>;
export default meta;

export const MainNavTabs = {
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
} satisfies StoryObj<typeof MainNavTabsComponent>;
