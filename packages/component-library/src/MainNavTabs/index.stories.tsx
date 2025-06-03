import type { Meta, StoryObj } from "@storybook/react";

import { Tabs } from "../unstyled/Tabs/index.jsx";
import { MainNavTabs as MainNavTabsComponent } from "./index.jsx";

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
      { children: "Products", segment: "products" },
      { children: "Developers", segment: "developers" },
    ],
  },
} satisfies StoryObj<typeof MainNavTabsComponent>;
