import type { Meta, StoryObj } from "@storybook/react";

import { SingleToggleGroup as SingleToggleGroupComponent } from "./index.js";

const meta = {
  component: SingleToggleGroupComponent,
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
  },
} satisfies Meta<typeof SingleToggleGroupComponent>;
export default meta;

export const SingleToggleGroup = {
  args: {
    items: [
      { id: "foo", children: "Foo" },
      { id: "bar", children: "Bar" },
    ],
  },
} satisfies StoryObj<typeof SingleToggleGroupComponent>;
