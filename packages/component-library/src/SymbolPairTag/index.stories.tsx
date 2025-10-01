import type { Meta, StoryObj } from "@storybook/react";
import CryptoIcon from "cryptocurrency-icons/svg/color/btc.svg";

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
    icon: <CryptoIcon width="100%" height="100%" viewBox="0 0 32 32" />,
    description: "Bitcoin",
  },
} satisfies StoryObj<typeof SymbolPairTagComponent>;
