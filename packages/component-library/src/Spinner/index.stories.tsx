import type { Meta, StoryObj } from "@storybook/react";

import { Spinner as SpinnerComponent } from "./index.jsx";

const meta = {
  component: SpinnerComponent,
  argTypes: {
    label: {
      control: "text",
      table: {
        category: "Spinner",
      },
    },
  },
} satisfies Meta<typeof SpinnerComponent>;
export default meta;

export const Spinner = {
  args: {
    label: "Spinner",
    isIndeterminate: true,
  },
} satisfies StoryObj<typeof SpinnerComponent>;
