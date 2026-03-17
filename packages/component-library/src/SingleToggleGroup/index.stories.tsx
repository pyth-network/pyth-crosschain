import type { Meta, StoryObj } from "@storybook/react";

import { SingleToggleGroup as SingleToggleGroupComponent } from "./index.jsx";

const meta = {
  argTypes: {
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
    rounded: {
      control: "boolean",
      table: {
        category: "Appearance",
      },
    },
  },
  component: SingleToggleGroupComponent,
} satisfies Meta<typeof SingleToggleGroupComponent>;
export default meta;

export const SingleToggleGroup = {
  args: {
    items: [
      { children: "Foo", id: "foo" },
      { children: "Bar", id: "bar" },
    ],
    rounded: false,
  },
} satisfies StoryObj<typeof SingleToggleGroupComponent>;
