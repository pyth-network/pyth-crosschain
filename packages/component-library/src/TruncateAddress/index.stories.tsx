import type { Meta, StoryObj } from "@storybook/react";

import { TruncateAddress as TruncateAddressComponent } from "./index"; // Only import the main component

const meta = {
  component: TruncateAddressComponent,
  argTypes: {
    text: {
      control: "text",
      description: "The address string to truncate.",
      table: {
        category: "Data",
      },
    },
    fixed: {
      control: "boolean",
      description:
        "Determines if the truncation uses a fixed number of characters (true) or is dynamic (false).",
      table: {
        category: "Behavior",
        defaultValue: { summary: "false" },
      },
    },
    minCharsStart: {
      control: "number",
      description:
        "Minimum characters to show at the start. Default for dynamic is 0, for fixed is 6.",
      table: {
        category: "Behavior",
      },
    },
    minCharsEnd: {
      control: "number",
      description:
        "Minimum characters to show at the end. Default for dynamic is 0, for fixed is 6.",
      table: {
        category: "Behavior",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "A component to truncate long strings, typically addresses, in a user-friendly way. It supports both dynamic (CSS-based, responsive) and fixed (JS-based, specific character counts) truncation.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TruncateAddressComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

const defaultAddress = "0x1234567890abcdef1234567890abcdef12345678";
const longEnsName = "verylongethereumdomainnamethatshouldbetruncated.eth";
const shortAddress = "0xABC";

export const DynamicDefault: Story = {
  args: {
    text: defaultAddress,
    fixed: false,
  },
  name: "Dynamic (Default Behavior)",
};

export const FixedDefault: Story = {
  args: {
    text: defaultAddress,
    fixed: true,
  },
  name: "Fixed (Default Behavior)",
};

export const DynamicCustomChars: Story = {
  args: {
    text: defaultAddress,
    fixed: false,
    minCharsStart: 4,
    minCharsEnd: 4,
  },
  name: "Dynamic (Custom minChars: 4 start, 4 end)",
};

export const FixedCustomChars: Story = {
  args: {
    text: defaultAddress,
    fixed: true,
    minCharsStart: 8,
    minCharsEnd: 8,
  },
  name: "Fixed (Custom minChars: 8 start, 8 end)",
};

export const DynamicEnsName: Story = {
  args: {
    text: longEnsName,
    fixed: false,
    minCharsStart: 10, // Show more for ENS names if dynamic
    minCharsEnd: 3,
  },
  name: "Dynamic (ENS Name)",
};

export const FixedEnsName: Story = {
  args: {
    text: longEnsName,
    fixed: true,
    minCharsStart: 10,
    minCharsEnd: 8, // .eth + 5 chars
  },
  name: "Fixed (ENS Name)",
};

export const DynamicShortAddress: Story = {
  args: {
    text: shortAddress,
    fixed: false,
    // minCharsStart/End will effectively show the whole string if it's shorter
  },
  name: "Dynamic (Short Address)",
};

export const FixedShortAddress: Story = {
  args: {
    text: shortAddress,
    fixed: true,
    minCharsStart: 2, // Will show 0x...BC if text is 0xABC
    minCharsEnd: 2,
  },
  name: "Fixed (Short Address)",
};

export const FixedVeryShortAddressShowsAll: Story = {
  args: {
    text: "0x1",
    fixed: true,
    minCharsStart: 6,
    minCharsEnd: 6,
  },
  name: "Fixed (Very Short Address, Shows All)",
  parameters: {
    docs: {
      description:
        "If the text is shorter than or equal to minCharsStart + minCharsEnd, the original text is shown.",
    },
  },
};

export const DynamicZeroMinChars: Story = {
  args: {
    text: defaultAddress,
    fixed: false,
    minCharsStart: 0,
    minCharsEnd: 0,
  },
  name: "Dynamic (Zero minChars)",
};

export const FixedZeroMinChars: Story = {
  args: {
    text: defaultAddress,
    fixed: true,
    minCharsStart: 0,
    minCharsEnd: 0,
  },
  name: "Fixed (Zero minChars, shows only ellipsis)",
};
