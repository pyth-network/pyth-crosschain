import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Checkbox } from "./Checkbox";
import { Text } from "../Text";

const CheckboxStory: Meta<typeof Checkbox>["render"] = (args) => {
  const [updatesChecked, setUpdatesChecked] = useState(true);
  const [summaryChecked, setSummaryChecked] = useState(false);
  const [alertsChecked, setAlertsChecked] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Checkbox
        {...args}
        checked={updatesChecked}
        onCheckedChange={(nextChecked, event) => {
          setUpdatesChecked(!!nextChecked);
          args.onCheckedChange?.(nextChecked, event);
        }}
      />
      <Checkbox
        checked={summaryChecked}
        label="Send weekly summary"
        onCheckedChange={(nextChecked) => {
          setSummaryChecked(nextChecked);
        }}
      />
      <Checkbox
        checked={alertsChecked}
        label={<Text>Enable trading alerts</Text>}
        onCheckedChange={(nextChecked) => {
          setAlertsChecked(nextChecked);
        }}
      />
    </div>
  );
};

const meta = {
  title: "V2/Checkbox",
  component: Checkbox,
  args: {
    checked: true,
    label: "Receive product updates",
  },
  argTypes: {
    onCheckedChange: { action: "onCheckedChange" },
  },
  render: CheckboxStory,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
