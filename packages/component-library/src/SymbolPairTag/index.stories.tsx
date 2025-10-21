import type { Meta, StoryObj } from "@storybook/react";

import { SymbolPairTag as SymbolPairTagComponent } from "./index.jsx";
const meta = {
  component: SymbolPairTagComponent,
  argTypes: {
    isLoading: {
      control: "boolean",
      table: {
        category: "State",
      },
    },
    icon: {
      description: "The icon to display",
      disable: true,
    },
    displaySymbol: {
      control: "text",
    },
    description: {
      control: "text",
    },
  },
} satisfies Meta<typeof SymbolPairTagComponent>;
export default meta;

export const SymbolPairTag = {
  args: {
    displaySymbol: "BTC/USD",
    isLoading: false,
    icon: undefined,
    description: "Bitcoin",
  },
} satisfies StoryObj<typeof SymbolPairTagComponent>;
