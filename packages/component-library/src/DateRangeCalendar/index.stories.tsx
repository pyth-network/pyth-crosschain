import type { Meta, StoryObj } from "@storybook/react";
import { parseDate } from "@internationalized/date";

import { DateRangeCalendar as DateRangeCalendarComponent } from "./index.jsx";

const meta = {
  component: DateRangeCalendarComponent,
  argTypes: {
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
    isInvalid: {
      control: "boolean",
      table: {
        category: "Behavior",
      },
    },
  },
} satisfies Meta<typeof DateRangeCalendarComponent>;
export default meta;

export const Default = {
  args: {
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
    defaultValue: {
      start: parseDate("2025-05-01"),
      end: parseDate("2025-05-13"),
    },
  },
} satisfies StoryObj<typeof DateRangeCalendarComponent>;

export const SingleDay = {
  args: {
    isDisabled: false,
    isReadOnly: false,
    defaultValue: {
      start: parseDate("2025-05-13"),
      end: parseDate("2025-05-13"),
    },
  },
} satisfies StoryObj<typeof DateRangeCalendarComponent>;

export const ReadOnly = {
  args: {
    isDisabled: false,
    isReadOnly: true,
    defaultValue: {
      start: parseDate("2025-05-01"),
      end: parseDate("2025-05-13"),
    },
  },
} satisfies StoryObj<typeof DateRangeCalendarComponent>;


