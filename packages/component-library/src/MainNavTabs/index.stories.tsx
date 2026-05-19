import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "../unstyled/Tabs/index.jsx";
import { MainNavTabs as MainNavTabsComponent } from "./index.jsx";

const meta = {
  argTypes: {
    tabs: {
      table: {
        disable: true,
      },
    },
  },
  component: MainNavTabsComponent,
} satisfies Meta<typeof MainNavTabsComponent>;
export default meta;

export const MainNavTabs = {
  args: {
    tabs: [
      { children: "Home", segment: "" },
      { children: "Foo", segment: "foo" },
      { children: "Bar", segment: "bar" },
    ],
  },
  decorators: [
    (Story) => (
      <Tabs>
        <Story />
      </Tabs>
    ),
  ],
} satisfies StoryObj<typeof MainNavTabsComponent>;
