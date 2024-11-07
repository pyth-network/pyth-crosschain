import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox as CheckboxComponent } from "./index.js";

const meta = {
  component: CheckboxComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CheckboxComponent>;
export default meta;

export const Checkbox = {
  args: {
    children:
      "By clicking here you agree that this is a checkbox and it's super duper checkboxy",
    isDisabled: false,
  },
} satisfies StoryObj<typeof CheckboxComponent>;
