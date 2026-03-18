import type { Meta, StoryObj } from "@storybook/react";

import { Term as TermComponent } from "./index.jsx";

const meta = {
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
  component: TermComponent,
} satisfies Meta<typeof TermComponent>;
export default meta;

export const Term = {
  args: {
    children: "This is a description",
    term: "Term",
  },
} satisfies StoryObj<typeof TermComponent>;
