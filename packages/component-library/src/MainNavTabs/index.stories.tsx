import type { Meta, StoryObj } from "@storybook/react";

import { MainNavTabs as MainNavTabsComponent } from "./index.jsx";
import { Tabs } from "../unstyled/Tabs/index.jsx";

const meta = {
  component: MainNavTabsComponent,
  argTypes: {
    tabs: {
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
      <Tabs>
        <Story />
      </Tabs>
    ),
  ],
  args: {
    tabs: [
      { children: "Home", segment: "" },
      { children: "Foo", segment: "foo" },
      { children: "Bar", segment: "bar" },
    ],
  },
} satisfies StoryObj<typeof MainNavTabsComponent>;
