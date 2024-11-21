import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup } from "react-aria-components";

import { Radio as RadioComponent } from "./index.js";

const meta = {
  component: RadioComponent,
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
      <RadioGroup className="max-w-sm">
        <Story />
      </RadioGroup>
    ),
  ],
} satisfies Meta<typeof RadioComponent>;
export default meta;

export const Radio = {
  args: {
    children:
      "This is a radio button, check out how radioish it is and how it handles multiline labels",
    isDisabled: false,
  },
} satisfies StoryObj<typeof RadioComponent>;
