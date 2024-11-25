import type { Meta, StoryObj } from "@storybook/react";

import { Card as CardComponent } from "./index.js";

const meta = {
  component: CardComponent,
  parameters: {
    backgrounds: {
      disable: true,
    },
  },
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof CardComponent>;
export default meta;

export const Card = {
  args: {
    children: "This is a card!",
  },
} satisfies StoryObj<typeof CardComponent>;
