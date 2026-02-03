import { MagnifyingGlass, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./Input";
import { IconControl } from "../../__stories__/helpers";

const meta = {
  title: "V2/Input/With Icons",
  component: Input,
  args: {
    beforeIcon: MagnifyingGlass,
    afterIcon: XCircle,
    label: "Search",
    placeholder: "Search by keyword",
    type: "search",
  },
  argTypes: {
    afterIcon: {
      ...IconControl,
    },
    beforeIcon: {
      ...IconControl,
    },
    onChange: { action: "onChange" },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
