import type { Meta, StoryObj } from "@storybook/react";

import { SingleToggleGroup as SingleToggleGroupComponent } from "./index.jsx";

const meta = {
  component: SingleToggleGroupComponent,
  argTypes: {
    rounded: {
      control: "boolean",
      table: {
        category: "Appearance",
      },
    },
    items: {
      table: {
        disable: true,
      },
    },
    onSelectionChange: {
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies Meta<typeof SingleToggleGroupComponent>;
export default meta;

export const SingleToggleGroup = {
  args: {
    rounded: false,
    items: [
      { id: "foo", children: "Foo" },
      { id: "bar", children: "Bar" },
    ],
  },
} satisfies StoryObj<typeof SingleToggleGroupComponent>;
