import type { Meta, StoryObj } from "@storybook/react";

import { MainNavTabs as MainNavTabsComponent } from "./index.jsx";
import { Tabs } from "../unstyled/Tabs/index.jsx";

const meta = {
  title: "navigation & menus/MainNavTabs",
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
      { children: "Products", segment: "products" },
      { children: "Developers", segment: "developers" },
    ],
  },
} satisfies StoryObj<typeof MainNavTabsComponent>;
