import type { Meta, StoryObj } from "@storybook/react";

import { SearchInput as SearchInputComponent, SIZES } from "./index.jsx";

const meta = {
  argTypes: {
    isDisabled: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    isPending: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
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
  },
  component: SearchInputComponent,
} satisfies Meta<typeof SearchInputComponent>;
export default meta;

export const SearchInput = {
  args: {
    isDisabled: false,
    isPending: false,
    size: "md",
    width: 60,
  },
} satisfies StoryObj<typeof SearchInputComponent>;
