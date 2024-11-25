import type { Meta, StoryObj } from "@storybook/react";

import {
  ORIENTATIONS,
  CheckboxGroup as CheckboxGroupComponent,
} from "./index.js";
import { Checkbox } from "../Checkbox/index.js";

const meta = {
  component: CheckboxGroupComponent,
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
      options: ORIENTATIONS,
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
    <CheckboxGroupComponent {...args}>
      <Checkbox value="one">
        {
          "By clicking here you agree that this is a checkbox and it's super duper checkboxy"
        }
      </Checkbox>
      <Checkbox value="two">Second</Checkbox>
      <Checkbox value="three">Third</Checkbox>
    </CheckboxGroupComponent>
  ),
} satisfies Meta<typeof CheckboxGroupComponent>;
export default meta;

export const CheckboxGroup = {
  args: {
    label: "This is a checkbox group!",
    description: "",
    isDisabled: false,
    orientation: "vertical",
  },
} satisfies StoryObj<typeof CheckboxGroupComponent>;
