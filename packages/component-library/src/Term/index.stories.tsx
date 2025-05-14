import type { Meta, StoryObj } from "@storybook/react";

import { Term as TermComponent } from "./index.jsx";

const meta = {
  component: TermComponent,
  argTypes: {
    children: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
    term: {
      control: "text",
      table: {
        category: "Contents",
      },
    },
  },
} satisfies Meta<typeof TermComponent>;
export default meta;

export const Term = {
  args: {
    term: "Term",
    children: "This is a description",
  },
} satisfies StoryObj<typeof TermComponent>;
