import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { NOOP } from "@pythnetwork/shared-lib/constants";
import type { Meta, StoryObj } from "@storybook/react";
import { useState, useEffect } from "react";

import { Toggle } from "./Switch";
import { IconControl } from "../../__stories__/helpers";

const SwitchStory: Meta<typeof Toggle>["render"] = (args) => {
  const [checked, setChecked] = useState(args.checked);

  // This ensures that when you toggle the control in the Storybook UI,
  // the component internal state updates accordingly.
  useEffect(() => {
    setChecked(args.checked);
  }, [args.checked]);

  return (
    <Toggle
      {...args}
      checked={checked}
      onChange={(nextChecked) => {
        setChecked(nextChecked);
        args.onChange(nextChecked);
      }}
    />
  );
};

const meta = {
  title: "V2/Switch",
  component: Toggle,
  args: {
    checked: true,
    onChange: NOOP,
    variant: "normal",
  },
  argTypes: {
    children: { control: "text" },
    onChange: { action: "onChange" },
    offIcon: IconControl,
    onIcon: IconControl,
    variant: {
      options: ["normal", "icon"],
      control: { type: "select" },
    },
  },
  // Moving the state logic into a wrapper component
  render: SwitchStory,
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Enable alerts",
    checked: false, // Defaulting to false for variety
  },
};

export const IconVariant: Story = {
  args: {
    checked: true,
    variant: "icon",
    onIcon: Sun,
    offIcon: Moon,
  },
};
