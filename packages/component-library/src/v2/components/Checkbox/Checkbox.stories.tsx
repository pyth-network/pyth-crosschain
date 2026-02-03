import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Checkbox } from "./Checkbox";
import type { InputSize } from "../../theme/theme";
import { Text } from "../Text";

const CheckboxStory: Meta<typeof Checkbox>["render"] = (args) => {
  const sizes: InputSize[] = ["xs", "sm", "md", "lg"];
  const [primaryCheckedBySize, setPrimaryCheckedBySize] = useState<
    Record<InputSize, boolean>
  >({
    xs: true,
    sm: false,
    md: true,
    lg: false,
  });
  const [summaryCheckedBySize, setSummaryCheckedBySize] = useState<
    Record<InputSize, boolean>
  >({
    xs: false,
    sm: true,
    md: false,
    lg: true,
  });
  const [alertsCheckedBySize, setAlertsCheckedBySize] = useState<
    Record<InputSize, boolean>
  >({
    xs: true,
    sm: true,
    md: false,
    lg: false,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {sizes.map((size) => (
        <div
          key={size}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <Text>{size.toUpperCase()}</Text>
          <Checkbox
            {...args}
            checked={primaryCheckedBySize[size]}
            size={size}
            onCheckedChange={(nextChecked, event) => {
              setPrimaryCheckedBySize((prev) => ({
                ...prev,
                [size]: !!nextChecked,
              }));
              args.onCheckedChange?.(nextChecked, event);
            }}
          />
          <Checkbox
            checked={summaryCheckedBySize[size]}
            label="Send weekly summary"
            size={size}
            onCheckedChange={(nextChecked) => {
              setSummaryCheckedBySize((prev) => ({
                ...prev,
                [size]: !!nextChecked,
              }));
            }}
          />
          <Checkbox
            checked={alertsCheckedBySize[size]}
            label={<Text>Enable trading alerts</Text>}
            size={size}
            onCheckedChange={(nextChecked) => {
              setAlertsCheckedBySize((prev) => ({
                ...prev,
                [size]: !!nextChecked,
              }));
            }}
          />
        </div>
      ))}
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
