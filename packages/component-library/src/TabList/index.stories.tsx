import type { Meta, StoryObj } from "@storybook/react";
import { Tabs as UnstyledTabs } from "../unstyled/Tabs/index.jsx";
import { TabList as TabListComponent } from "./index.jsx";

const meta = {
  argTypes: {
    currentTab: {
      table: {
        disable: true,
      },
    },
    items: {
      table: {
        disable: true,
      },
    },
  },
  component: TabListComponent,
} satisfies Meta<typeof TabListComponent>;
export default meta;

export const TabList = {
  args: {
    items: [
      { children: "Foo", id: "foo" },
      { children: "Bar", id: "bar" },
    ],
    label: "Tab List",
  },
  decorators: [
    (Story) => (
      <UnstyledTabs>
        <Story />
      </UnstyledTabs>
    ),
  ],
} satisfies StoryObj<typeof TabListComponent>;
