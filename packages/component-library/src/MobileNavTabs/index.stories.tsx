import type { Meta, StoryObj } from "@storybook/react";

import { MobileNavTabs as MobileNavTabsComponent } from "./index.jsx";

const meta = {
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
      { children: "Foo", segment: "foo" },
      { children: "Bar", segment: "bar" },
    ],
  },
} satisfies StoryObj<typeof MobileNavTabsComponent>;
