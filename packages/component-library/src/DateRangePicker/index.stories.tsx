import type { Meta, StoryObj } from "@storybook/react";

import { DateRangePicker as DateRangePickerComponent } from "./index.jsx";

const meta = {
  component: DateRangePickerComponent,
  decorators: [
    (Story) => (
      <div style={{ minHeight: '700px' }}>
        <Story />
      </div>
    ),
  ],
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
    buttonLabel: {
      control: "text",
      table: {
        category: "Label",
      },
    },
    variant: {
      control: "select",
      options: [
        "primary",
        "secondary",
        "solid",
        "outline",
        "ghost",
        "success",
        "danger",
      ],
      table: {
        category: "Appearance",
      },
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
      table: {
        category: "Appearance",
      },
    },
    showPresets: {
      control: "boolean",
      table: {
        category: "Behavior",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "Behavior",
      },
    },
    onChange: {
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies Meta<typeof DateRangePickerComponent>;
export default meta;

export const Default = {
  args: {
    label: "Select date range",
    hideLabel: false,
    variant: "outline",
    size: "md",
    showPresets: true,
    isDisabled: false,
    defaultValue: {
      start: new Date(2025, 4, 13, 15, 28),
      end: new Date(2025, 4, 13, 15, 28),
    },
  },
} satisfies StoryObj<typeof DateRangePickerComponent>;

export const NoPresets = {
  args: {
    label: "Select date range",
    hideLabel: true,
    variant: "outline",
    size: "md",
    showPresets: false,
    isDisabled: false,
    defaultValue: {
      start: new Date(2025, 4, 1),
      end: new Date(2025, 4, 13),
    },
  },
} satisfies StoryObj<typeof DateRangePickerComponent>;