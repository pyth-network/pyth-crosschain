import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { NOOP } from "@pythnetwork/shared-lib/constants";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { IconControl } from "../../__stories__/helpers";
import { Toggle } from "./Switch";

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
  args: {
    checked: true,
    onChange: NOOP,
    variant: "normal",
  },
  argTypes: {
    children: { control: "text" },
    offIcon: IconControl,
    onChange: { action: "onChange" },
    onIcon: IconControl,
    variant: {
      control: { type: "select" },
      options: ["normal", "icon"],
    },
  },
  component: Toggle,
  // Moving the state logic into a wrapper component
  render: SwitchStory,
  title: "V2/Switch",
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false, // Defaulting to false for variety
    children: "Enable alerts",
  },
};

export const IconVariant: Story = {
  args: {
    checked: true,
    offIcon: Moon,
    onIcon: Sun,
    variant: "icon",
  },
};
