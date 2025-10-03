import type { Meta, StoryObj } from "@storybook/react";

import { TimeField as TimeFieldComponent } from "./index.jsx";

const meta = {
  component: TimeFieldComponent,
  argTypes: {
    label: {
      control: "text",
      table: {
        category: "Label",
      },
    },
    hideLabel: {
      control: "boolean",
      table: {
        category: "Label",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "Behavior",
      },
    },
    isReadOnly: {
      control: "boolean",
      table: {
        category: "Behavior",
      },
    },
    isRequired: {
      control: "boolean",
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies Meta<typeof TimeFieldComponent>;
export default meta;

export const Default = {
  args: {
    label: "Start time",
    hideLabel: false,
    isDisabled: false,
    isReadOnly: false,
    isRequired: false,
  },
} satisfies StoryObj<typeof TimeFieldComponent>;

export const WithClearButton = {
  args: {
    label: "End time",
    hideLabel: false,
    isDisabled: false,
    onClear: () => {
      console.log("Clear clicked");
    },
  },
} satisfies StoryObj<typeof TimeFieldComponent>;

export const HiddenLabel = {
  args: {
    label: "Time",
    hideLabel: true,
    isDisabled: false,
  },
} satisfies StoryObj<typeof TimeFieldComponent>;


