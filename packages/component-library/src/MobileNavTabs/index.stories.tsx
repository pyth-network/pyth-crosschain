import type { Meta, StoryObj } from "@storybook/react";

import { MobileNavTabs as MobileNavTabsComponent } from "./index.jsx";

const meta = {
  title: "navigation & menus/MobileNavTabs",
  component: MobileNavTabsComponent,
  parameters: {
    layout: "padded",
  },
  argTypes: {
    tabs: {
      table: {
        disable: true,
      },
    },
  },
} satisfies Meta<typeof MobileNavTabsComponent>;
export default meta;

export const MobileNavTabs = {
  args: {
    tabs: [
      { children: "Home", segment: "" },
      { children: "Products", segment: "products" },
      { children: "Developers", segment: "developers" },
    ],
  },
} satisfies StoryObj<typeof MobileNavTabsComponent>;
