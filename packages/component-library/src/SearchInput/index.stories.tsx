import type { Meta, StoryObj } from "@storybook/react";

import { SearchInput as SearchInputComponent, SIZES } from "./index.jsx";

const meta = {
  component: SearchInputComponent,
  argTypes: {
    label: {
      table: {
        disable: true,
      },
    },
    size: {
      control: "inline-radio",
      options: SIZES,
      table: {
        category: "Size",
      },
    },
    width: {
      control: "number",
      table: {
        category: "Size",
      },
    },
    isPending: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
  },
} satisfies Meta<typeof SearchInputComponent>;
export default meta;

export const SearchInput = {
  args: {
    size: "md",
    width: 60,
    isPending: false,
    isDisabled: false,
  },
} satisfies StoryObj<typeof SearchInputComponent>;
