import type { Meta, StoryObj } from "@storybook/react";

import { RadioGroup as RadioGroupComponent } from "./index.js";
import { Radio } from "../Radio/index.js";

const meta = {
  component: RadioGroupComponent,
  argTypes: {
    label: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    description: {
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
    orientation: {
      control: "inline-radio",
      options: ["vertical", "horizontal"],
      table: {
        category: "Layout",
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
  render: (args) => (
    <RadioGroupComponent {...args}>
      <Radio value="one">
        This is a radio button, check out how radioish it is and how it handles
        multiline labels
      </Radio>
      <Radio value="two">Second</Radio>
      <Radio value="three">Third</Radio>
    </RadioGroupComponent>
  ),
} satisfies Meta<typeof RadioGroupComponent>;
export default meta;

export const RadioGroup = {
  args: {
    label: "This is a radio group!",
    description: "",
    isDisabled: false,
    orientation: "vertical",
  },
} satisfies StoryObj<typeof RadioGroupComponent>;
