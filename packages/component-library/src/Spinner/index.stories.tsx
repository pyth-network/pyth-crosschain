import type { Meta, StoryObj } from "@storybook/react";

import { Spinner as SpinnerComponent } from "./index.jsx";

const meta = {
  argTypes: {
    label: {
      control: "text",
      table: {
        category: "Spinner",
      },
    },
  },
  component: SpinnerComponent,
} satisfies Meta<typeof SpinnerComponent>;
export default meta;

export const Spinner = {
  args: {
    isIndeterminate: true,
    label: "Spinner",
  },
} satisfies StoryObj<typeof SpinnerComponent>;
