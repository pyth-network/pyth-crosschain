import type { Meta, StoryObj } from "@storybook/react";

import { Category, argTypes } from "./arg-types.js";
import { Button as ButtonComponent } from "./index.js";

const meta = {
  component: ButtonComponent,
  argTypes: {
    ...argTypes,
    onPress: {
      table: {
        category: "Behavior",
      },
    },
    isPending: {
      control: "boolean",
      table: {
        category: Category.State,
      },
    },
  },
} satisfies Meta<typeof ButtonComponent>;
export default meta;

export const Button = {
  args: {
    children: "Button",
    variant: "primary",
    size: "md",
    isDisabled: false,
    isPending: false,
    rounded: false,
  },
} satisfies StoryObj<typeof ButtonComponent>;
