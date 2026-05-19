import type { Meta, StoryObj } from "@storybook/react";

import { SymbolPairTag as SymbolPairTagComponent } from "./index.jsx";

const meta = {
  argTypes: {
    description: {
      control: "text",
    },
    displaySymbol: {
      control: "text",
    },
    icon: {
      description: "The icon to display",
      disable: true,
    },
    isLoading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
  },
  component: SymbolPairTagComponent,
} satisfies Meta<typeof SymbolPairTagComponent>;
export default meta;

export const SymbolPairTag = {
  args: {
    description: "Bitcoin",
    displaySymbol: "BTC/USD",
    icon: undefined,
    isLoading: false,
  },
} satisfies StoryObj<typeof SymbolPairTagComponent>;
